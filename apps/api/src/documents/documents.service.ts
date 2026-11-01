import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import {
  CreateUploadSessionDto,
  IssueDocumentDto,
  RevokeDocumentDto,
  CreateShareDto,
} from './dto/documents.dto';
import {
  calculateSha256Sync,
  generateCredentialId,
  generateNonce,
  calculateCommitment,
  generateHmacLookup,
  encryptFileEnvelope,
  encryptAesGcm,
  decryptAesGcm,
  recoverIssuanceSigner,
  recoverRevocationSigner,
  EIP712_TYPES,
} from '@docauth/crypto';
import {
  OrgStatus,
  KeyStatus,
  DocumentStatus,
  COMMITMENT_VERSION,
  CREDENTIAL_SCHEMA_VERSION,
  MAX_FILE_SIZE_BYTES,
  PDF_MAGIC_BYTES,
} from '@docauth/shared';

export interface ISessionState {
  uploadSessionId: string;
  organizationId: string;
  issuerId: string;
  documentTypeCode: string;
  holderEmail: string;
  holderSubjectReference: string;
  expiresAt: Date | null;
  issuedAt: number;
  credentialId: string;
  documentHash: string;
  nonce: string;
  commitment: string;
  keyVersion: number;
  fileObjectId: string;
}

@Injectable()
export class DocumentsService {
  private readonly kmsMasterKey: string;
  private readonly hmacSecret: string;
  private readonly chainId: number;
  private readonly verifyingContract: string;
  private readonly publicVerifyBaseUrl: string;

  // In-memory cache for active issuance staging sessions
  private readonly stagingSessions = new Map<string, ISessionState>();

  constructor(
    private prisma: PrismaService,
    private storage: FileStorageService,
    private configService: ConfigService,
  ) {
    this.kmsMasterKey = this.configService.get<string>(
      'KMS_MASTER_KEY_HEX',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
    this.hmacSecret = this.configService.get<string>(
      'DOCUMENT_HMAC_SECRET',
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    );
    this.chainId = Number(this.configService.get<string>('BLOCKCHAIN_CHAIN_ID', '80002'));
    this.verifyingContract = this.configService.get<string>(
      'DOCUMENT_REGISTRY_ADDRESS',
      '0x0000000000000000000000000000000000000000',
    );
    this.publicVerifyBaseUrl = this.configService.get<string>(
      'PUBLIC_VERIFICATION_URL',
      'http://localhost:3000/verify',
    );
  }

  /**
   * Initiates an issuance session for an authorized organization.
   */
  async createUploadSession(organizationId: string, dto: CreateUploadSessionDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        issuerKeys: {
          where: { keyStatus: KeyStatus.ACTIVE as any },
          orderBy: { keyVersion: 'desc' },
        },
      },
    });

    if (!org) throw new NotFoundException('Organization not found.');
    if (org.verificationStatus !== OrgStatus.ACTIVE) {
      throw new BadRequestException('Organization must be ACTIVE on Polygon to issue authenticated documents.');
    }
    if (!org.issuerId) {
      throw new BadRequestException('Organization does not have an on-chain Issuer ID provisioned.');
    }
    if (org.issuerKeys.length === 0) {
      throw new BadRequestException('Organization does not have an active signing key registered.');
    }

    const uploadSessionId = `session_${randomBytes(16).toString('hex')}`;
    return {
      uploadSessionId,
      organizationId,
      issuerId: org.issuerId,
      activeKeyVersion: org.issuerKeys[0].keyVersion,
    };
  }

  /**
   * Processes the uploaded PDF: performs byte-level validation, calculates authoritative SHA-256,
   * generates credentialId and nonce, computes commitment, stores encrypted file, and returns EIP-712 payload.
   */
  async processAndFinalizeUpload(
    organizationId: string,
    uploadSessionId: string,
    fileBuffer: Buffer,
    dto: CreateUploadSessionDto,
  ) {
    // 1. File security validations (OWASP File Upload standards)
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Empty file upload.');
    }
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`File size exceeds maximum ceiling of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
    }

    // Magic byte audit: requires %PDF- header (0x25 0x50 0x44 0x46 0x2D)
    if (fileBuffer.length < 5 || !fileBuffer.subarray(0, 5).equals(PDF_MAGIC_BYTES)) {
      throw new BadRequestException('Invalid file format. File must be a valid PDF document with %PDF- header.');
    }

    // 2. Fetch Organization and Active Key
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        issuerKeys: {
          where: { keyStatus: KeyStatus.ACTIVE as any },
          orderBy: { keyVersion: 'desc' },
        },
      },
    });
    if (!org || !org.issuerId || org.issuerKeys.length === 0) {
      throw new BadRequestException('Organization is not authorized for issuance.');
    }
    const activeKey = org.issuerKeys[0];

    // 3. Authoritative SHA-256 byte calculation on unmodified PDF bytes
    const documentHash = calculateSha256Sync(fileBuffer);

    // 4. Cryptographic Nonce & Credential ID Generation (CSPRNG 256 bits)
    const credentialId = generateCredentialId();
    const nonce = generateNonce();

    // 5. Compute Privacy-Preserving Keccak-256 Commitment
    const commitment = calculateCommitment(
      COMMITMENT_VERSION,
      credentialId,
      org.issuerId,
      documentHash,
      nonce,
    );

    // 6. Compute Keyed HMAC Lookup Index
    const hashLookup = generateHmacLookup(documentHash, this.hmacSecret);

    // 7. Envelope Encryption (AES-256-GCM) & Storage
    const envelope = encryptFileEnvelope(fileBuffer, this.kmsMasterKey);
    const serializedEnvelope = Buffer.from(JSON.stringify(envelope));

    const objectKey = `${credentialId.replace(/^0x/, '')}.enc`;
    await this.storage.uploadFile(
      this.storage.permanentBucket,
      objectKey,
      serializedEnvelope,
      'application/octet-stream',
    );

    // Encrypt raw document hash and nonce before storing in database
    const encryptedDocHash = JSON.stringify(encryptAesGcm(documentHash, this.kmsMasterKey));
    const encryptedNonce = JSON.stringify(encryptAesGcm(nonce, this.kmsMasterKey));

    // Save FileObject in database
    const fileObject = await this.prisma.fileObject.create({
      data: {
        objectKey,
        storageProvider: 'minio',
        contentType: 'application/pdf',
        fileSize: BigInt(fileBuffer.length),
        encryptedSha256: encryptedDocHash,
        hashLookup,
        scanStatus: 'CLEAN',
        encryptionKeyReference: 'kms:local:master',
      },
    });

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAtSeconds = dto.expiresAt ? Math.floor(new Date(dto.expiresAt).getTime() / 1000) : 0;

    // Cache session in memory awaiting issuer signature
    this.stagingSessions.set(uploadSessionId, {
      uploadSessionId,
      organizationId,
      issuerId: org.issuerId,
      documentTypeCode: dto.documentTypeCode,
      holderEmail: dto.holderEmail,
      holderSubjectReference: dto.holderSubjectReference,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      issuedAt,
      credentialId,
      documentHash,
      nonce,
      commitment,
      keyVersion: activeKey.keyVersion,
      fileObjectId: fileObject.id,
    });

    // 8. Construct EIP-712 structured data payload for client signature
    const eip712Domain = {
      name: 'DecentralizedDocumentPlatform',
      version: '1',
      chainId: this.chainId,
      verifyingContract: this.verifyingContract,
    };

    const eip712Message = {
      issuerId: org.issuerId,
      credentialId,
      commitment,
      issuedAt,
      expiresAt: expiresAtSeconds,
      keyVersion: activeKey.keyVersion,
      schemaVersion: CREDENTIAL_SCHEMA_VERSION,
    };

    return {
      uploadSessionId,
      credentialId,
      commitment,
      documentHash,
      keyVersion: activeKey.keyVersion,
      eip712Payload: {
        domain: eip712Domain,
        types: {
          IssueCredential: EIP712_TYPES.IssueCredential,
        },
        message: eip712Message,
      },
    };
  }

  /**
   * Finalizes credential issuance: verifies EIP-712 digital signature against authorized issuer key,
   * creates database records, enqueues blockchain transaction outbox task, and generates QR code.
   */
  async issue(organizationId: string, uploadSessionId: string, dto: IssueDocumentDto) {
    const session = this.stagingSessions.get(uploadSessionId);
    if (!session || session.organizationId !== organizationId) {
      throw new BadRequestException('Invalid or expired upload session. Finalize the upload first.');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        issuerKeys: {
          where: { keyVersion: session.keyVersion },
        },
      },
    });

    if (!org || org.issuerKeys.length === 0) {
      throw new BadRequestException('Signing key configuration not found for keyVersion.');
    }
    const authorizedKey = org.issuerKeys[0];

    // 1. Recover and cryptographically verify EIP-712 signer
    const domain = {
      name: 'DecentralizedDocumentPlatform',
      version: '1',
      chainId: this.chainId,
      verifyingContract: this.verifyingContract,
    };

    const expiresAtSeconds = session.expiresAt ? Math.floor(session.expiresAt.getTime() / 1000) : 0;
    const message = {
      issuerId: session.issuerId,
      credentialId: session.credentialId,
      commitment: session.commitment,
      issuedAt: session.issuedAt,
      expiresAt: expiresAtSeconds,
      keyVersion: session.keyVersion,
      schemaVersion: CREDENTIAL_SCHEMA_VERSION,
    };

    let recoveredSigner: string;
    try {
      recoveredSigner = recoverIssuanceSigner(domain, message, dto.signature);
    } catch (err: any) {
      throw new BadRequestException(`Malformed or invalid EIP-712 signature: ${err.message}`);
    }

    if (recoveredSigner.toLowerCase() !== authorizedKey.walletAddress.toLowerCase()) {
      throw new ForbiddenException(
        `Signature signer (${recoveredSigner}) does not match authorized issuer key address (${authorizedKey.walletAddress}) for Version ${session.keyVersion}.`,
      );
    }

    // 2. Persist in database using Transactional Outbox Pattern
    const result = await this.prisma.$transaction(async (tx) => {
      // Find or create document type
      let docType = await tx.documentType.findUnique({
        where: { code: session.documentTypeCode },
      });
      if (!docType) {
        docType = await tx.documentType.create({
          data: {
            code: session.documentTypeCode,
            displayName: session.documentTypeCode.replace(/_/g, ' '),
          },
        });
      }

      // Create or find CredentialHolder
      const encryptedSubject = JSON.stringify(encryptAesGcm(session.holderSubjectReference, this.kmsMasterKey));
      const encryptedContact = JSON.stringify(encryptAesGcm(session.holderEmail, this.kmsMasterKey));

      const holder = await tx.credentialHolder.create({
        data: {
          encryptedSubjectReference: encryptedSubject,
          encryptedContactInformation: encryptedContact,
          claimInvitationCodeHash: createHash('sha256').update(randomBytes(16)).digest('hex'),
        },
      });

      // Encrypt document hash and nonce
      const encryptedDocHash = JSON.stringify(encryptAesGcm(session.documentHash, this.kmsMasterKey));
      const encryptedNonce = JSON.stringify(encryptAesGcm(session.nonce, this.kmsMasterKey));

      // Create Document
      const document = await tx.document.create({
        data: {
          credentialId: session.credentialId,
          issuerOrgId: organizationId,
          holderId: holder.id,
          documentTypeId: docType.id,
          fileObjectId: session.fileObjectId,
          documentHashEncrypted: encryptedDocHash,
          commitment: session.commitment,
          encryptedNonce,
          issuerKeyId: authorizedKey.id,
          issuerSignature: dto.signature,
          documentStatus: DocumentStatus.PENDING_BLOCKCHAIN as any,
          issuedAt: new Date(session.issuedAt * 1000),
          expiresAt: session.expiresAt,
        },
      });

      // Create Status History
      await tx.documentStatusHistory.create({
        data: {
          documentId: document.id,
          previousStatus: DocumentStatus.NONE as any,
          newStatus: DocumentStatus.PENDING_BLOCKCHAIN as any,
          actorId: (await tx.user.findFirst())?.id || 'system',
          reason: 'Initial authenticated issuance submitted',
        },
      });

      // Create Transactional Outbox task for background blockchain relayer
      await tx.outboxMessage.create({
        data: {
          topic: 'blockchain-document-issuance',
          payload: {
            documentId: document.id,
            credentialId: session.credentialId,
            issuerId: session.issuerId,
            commitment: session.commitment,
            issuedAt: session.issuedAt,
            expiresAt: expiresAtSeconds,
            keyVersion: session.keyVersion,
            schemaVersion: CREDENTIAL_SCHEMA_VERSION,
            signature: dto.signature,
          },
        },
      });

      return { document, holder };
    });

    // Remove from staging cache
    this.stagingSessions.delete(uploadSessionId);

    // 3. Generate QR code encoding public verification URL
    const verificationUrl = `${this.publicVerifyBaseUrl}/${session.credentialId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
    });

    return {
      documentId: result.document.id,
      credentialId: session.credentialId,
      commitment: session.commitment,
      status: DocumentStatus.PENDING_BLOCKCHAIN,
      verificationUrl,
      qrCodeDataUrl,
      issuedAt: session.issuedAt,
    };
  }

  /**
   * Revokes an active credential with authorized signature.
   */
  async revoke(organizationId: string, documentId: string, dto: RevokeDocumentDto) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        issuerOrgId: organizationId,
      },
      include: {
        issuerOrganization: true,
        issuerKey: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found for this organization.');
    }
    if (document.documentStatus === (DocumentStatus.REVOKED as any)) {
      throw new BadRequestException('Document is already revoked.');
    }

    const revokedAt = Math.floor(Date.now() / 1000);
    const reasonHash = `0x${createHash('sha256').update(dto.reason).digest('hex')}`;

    // Verify revocation signature
    const domain = {
      name: 'DecentralizedDocumentPlatform',
      version: '1',
      chainId: this.chainId,
      verifyingContract: this.verifyingContract,
    };

    const message = {
      credentialId: document.credentialId,
      reasonHash,
      revokedAt,
    };

    let recoveredSigner: string;
    try {
      recoveredSigner = recoverRevocationSigner(domain, message, dto.signature);
    } catch (err: any) {
      throw new BadRequestException(`Invalid revocation signature: ${err.message}`);
    }

    if (recoveredSigner.toLowerCase() !== document.issuerKey.walletAddress.toLowerCase()) {
      throw new ForbiddenException('Revocation signature does not match authorized issuer key.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.document.update({
        where: { id: documentId },
        data: {
          documentStatus: DocumentStatus.REVOKED as any,
        },
      });

      await tx.documentStatusHistory.create({
        data: {
          documentId,
          previousStatus: document.documentStatus,
          newStatus: DocumentStatus.REVOKED as any,
          actorId: (await tx.user.findFirst())?.id || 'system',
          reason: dto.reason,
        },
      });

      await tx.outboxMessage.create({
        data: {
          topic: 'blockchain-document-revocation',
          payload: {
            credentialId: document.credentialId,
            reasonHash,
            revokedAt,
            signature: dto.signature,
          },
        },
      });

      return {
        id: updated.id,
        credentialId: updated.credentialId,
        status: DocumentStatus.REVOKED,
        revokedAt,
      };
    });
  }

  /**
   * Lists documents for the organization.
   */
  async listDocuments(organizationId: string) {
    return this.prisma.document.findMany({
      where: { issuerOrgId: organizationId },
      include: {
        documentType: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves single document detail.
   */
  async getDocument(organizationId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        issuerOrgId: organizationId,
      },
      include: {
        documentType: true,
        fileObject: true,
        statusHistory: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    const downloadUrl = await this.storage.getPresignedDownloadUrl(
      this.storage.permanentBucket,
      document.fileObject.objectKey,
    );

    return {
      id: document.id,
      credentialId: document.credentialId,
      commitment: document.commitment,
      documentStatus: document.documentStatus,
      documentType: document.documentType.displayName,
      issuedAt: document.issuedAt,
      expiresAt: document.expiresAt,
      downloadUrl,
      statusHistory: document.statusHistory,
    };
  }
}

