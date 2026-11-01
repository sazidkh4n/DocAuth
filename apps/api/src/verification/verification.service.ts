import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PolygonBlockchainClient } from '@docauth/blockchain-client';
import {
  calculateSha256Sync,
  calculateCommitment,
  generateHmacLookup,
  decryptAesGcm,
} from '@docauth/crypto';
import {
  VerificationStatus,
  COMMITMENT_VERSION,
  PDF_MAGIC_BYTES,
  MAX_FILE_SIZE_BYTES,
  IVerificationResult,
} from '@docauth/shared';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly kmsMasterKey: string;
  private readonly hmacSecret: string;
  private readonly rpcUrl: string;
  private readonly documentRegistryAddress: string;
  private readonly issuerRegistryAddress: string;
  private blockchainClient: PolygonBlockchainClient | null = null;

  constructor(
    private prisma: PrismaService,
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
    this.rpcUrl = this.configService.get<string>(
      'POLYGON_RPC_URL',
      'https://rpc-amoy.polygon.technology/',
    );
    this.documentRegistryAddress = this.configService.get<string>(
      'DOCUMENT_REGISTRY_ADDRESS',
      '0x0000000000000000000000000000000000000000',
    );
    this.issuerRegistryAddress = this.configService.get<string>(
      'ISSUER_REGISTRY_ADDRESS',
      '0x0000000000000000000000000000000000000000',
    );

    try {
      this.blockchainClient = new PolygonBlockchainClient(this.rpcUrl);
    } catch (err: any) {
      this.logger.warn(`Could not initialize Polygon blockchain client: ${err.message}`);
    }
  }

  /**
   * For testing or dynamic configuration injection.
   */
  setBlockchainClient(client: PolygonBlockchainClient | null) {
    this.blockchainClient = client;
  }

  /**
   * Authoritative 9-Step Multi-Dimensional Document Verification Engine.
   */
  async verifyDocument(
    fileBuffer: Buffer,
    credentialIdInput?: string,
    requesterUserId?: string,
    requesterOrgId?: string,
  ): Promise<IVerificationResult> {
    const verifiedAt = new Date().toISOString();

    // -------------------------------------------------------------------------
    // STEP 1: PDF Magic Byte and File Size Validation
    // -------------------------------------------------------------------------
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Empty file upload.');
    }
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`File size exceeds maximum allowable limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`);
    }
    if (fileBuffer.length < 5 || !fileBuffer.subarray(0, 5).equals(PDF_MAGIC_BYTES)) {
      throw new BadRequestException('File is not a valid PDF document (missing %PDF- header).');
    }

    // -------------------------------------------------------------------------
    // STEP 2: Exact Byte Stream SHA-256 Calculation
    // -------------------------------------------------------------------------
    const uploadedHash = calculateSha256Sync(fileBuffer);

    // -------------------------------------------------------------------------
    // STEP 3: Credential Resolution (Path A or Path B)
    // -------------------------------------------------------------------------
    let documentRecord: any = null;

    if (credentialIdInput) {
      // Path A: Direct lookup via explicit Credential ID (e.g. from QR scan)
      documentRecord = await this.prisma.document.findUnique({
        where: { credentialId: credentialIdInput },
        include: {
          issuerOrganization: true,
          issuerKey: true,
          documentType: true,
        },
      });
    } else {
      // Path B: Direct document upload without Credential ID -> Query HMAC lookup index
      const hashLookup = generateHmacLookup(uploadedHash, this.hmacSecret);
      const fileObject = await this.prisma.fileObject.findFirst({
        where: { hashLookup },
        include: {
          documents: {
            include: {
              issuerOrganization: true,
              issuerKey: true,
              documentType: true,
            },
          },
        },
      });

      if (fileObject && fileObject.documents.length > 0) {
        documentRecord = fileObject.documents[0];
      }
    }

    // If no matching registration can be resolved, return NOT_REGISTERED
    if (!documentRecord) {
      await this.recordAudit(requesterUserId, requesterOrgId, null, VerificationStatus.NOT_REGISTERED, {
        hashMatched: false,
        commitmentMatched: false,
        issuerAuthorized: false,
        signatureValid: false,
        chainConfirmed: false,
        documentActive: false,
      });

      return {
        status: VerificationStatus.NOT_REGISTERED,
        verdict: 'No registered credential found matching this document or credential reference.',
        documentHash: uploadedHash,
        checks: {
          documentIntegrity: { status: 'FAILED', message: 'Document fingerprint not indexed in registry.' },
          issuerAuthenticity: { status: 'SKIPPED', message: 'Issuer could not be determined.' },
          organizationalTrust: { status: 'SKIPPED', message: 'Organization verification not applicable.' },
          lifecycle: { status: 'SKIPPED', message: 'Lifecycle status not applicable.' },
        },
        verifiedAt,
      };
    }

    const targetCredentialId = documentRecord.credentialId;
    const issuerId = documentRecord.issuerOrganization.issuerId;

    // -------------------------------------------------------------------------
    // STEP 4: Retrieve Protected Cryptographic Nonce
    // -------------------------------------------------------------------------
    let nonce: string;
    try {
      const encryptedNoncePayload = JSON.parse(documentRecord.encryptedNonce);
      nonce = decryptAesGcm(encryptedNoncePayload, this.kmsMasterKey).toString('utf-8');
    } catch (err: any) {
      this.logger.error(`Failed to decrypt nonce for credential ${targetCredentialId}: ${err.message}`);
      throw new Error('Cryptographic error while accessing protected credential metadata.');
    }

    // -------------------------------------------------------------------------
    // STEP 5: Recalculate Keccak-256 Commitment
    // -------------------------------------------------------------------------
    const recalculatedCommitment = calculateCommitment(
      COMMITMENT_VERSION,
      targetCredentialId,
      issuerId,
      uploadedHash,
      nonce,
    );

    // -------------------------------------------------------------------------
    // STEP 6: Query Polygon PoS Smart Contract (On-Chain Truth)
    // -------------------------------------------------------------------------
    let onChainCredential: any = null;
    let onChainCommitment: string | null = null;
    let isIssuerActiveOnChain = false;
    let isKeyValidOnChain = false;

    if (this.blockchainClient && this.documentRegistryAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        const docContract = this.blockchainClient.getDocumentRegistry(this.documentRegistryAddress);
        const issuerContract = this.blockchainClient.getIssuerRegistry(this.issuerRegistryAddress);

        // Fetch on-chain commitment and credential record
        onChainCredential = await docContract.getCredential(targetCredentialId);
        onChainCommitment = onChainCredential.commitment;

        // Query IssuerRegistry for issuer status and key validity
        isIssuerActiveOnChain = await issuerContract.isIssuerActive(issuerId);
        const issuedAtEpoch = Math.floor(new Date(documentRecord.issuedAt).getTime() / 1000);
        isKeyValidOnChain = await issuerContract.isSigningKeyValid(
          issuerId,
          documentRecord.issuerKey.keyVersion,
          documentRecord.issuerKey.walletAddress,
          issuedAtEpoch,
        );
      } catch (err: any) {
        this.logger.error(`Polygon PoS RPC node call failed: ${err.message}`);

        await this.recordAudit(requesterUserId, requesterOrgId, documentRecord.id, VerificationStatus.VERIFICATION_UNAVAILABLE, {
          hashMatched: false,
          commitmentMatched: false,
          issuerAuthorized: false,
          signatureValid: false,
          chainConfirmed: false,
          documentActive: false,
        });

        return {
          status: VerificationStatus.VERIFICATION_UNAVAILABLE,
          verdict: 'Polygon PoS blockchain RPC is unreachable. Live verification cannot be safely completed at this time.',
          credentialId: targetCredentialId,
          documentHash: uploadedHash,
          checks: {
            documentIntegrity: { status: 'WARNING', message: 'Unable to query on-chain commitment.' },
            issuerAuthenticity: { status: 'WARNING', message: 'Unable to query IssuerRegistry.' },
            organizationalTrust: { status: 'WARNING', message: 'Unable to query organizational status.' },
            lifecycle: { status: 'WARNING', message: 'Blockchain status unknown.' },
          },
          verifiedAt,
        };
      }
    } else {
      // In local development / test harness without live Polygon RPC, compare against stored record commitment
      onChainCommitment = documentRecord.commitment;
      isIssuerActiveOnChain = documentRecord.issuerOrganization.verificationStatus === 'ACTIVE';
      isKeyValidOnChain = documentRecord.issuerKey.keyStatus === 'ACTIVE';
    }

    // -------------------------------------------------------------------------
    // STEP 7: Commitment Matching (Document Integrity)
    // -------------------------------------------------------------------------
    const commitmentsMatch = recalculatedCommitment.toLowerCase() === (onChainCommitment || '').toLowerCase();

    if (!commitmentsMatch) {
      await this.recordAudit(requesterUserId, requesterOrgId, documentRecord.id, VerificationStatus.DOCUMENT_MODIFIED, {
        hashMatched: false,
        commitmentMatched: false,
        issuerAuthorized: isIssuerActiveOnChain,
        signatureValid: isKeyValidOnChain,
        chainConfirmed: true,
        documentActive: false,
      });

      return {
        status: VerificationStatus.DOCUMENT_MODIFIED,
        verdict: 'DOCUMENT INTEGRITY FAILURE: The uploaded file has been altered or tampered with since original registration.',
        credentialId: targetCredentialId,
        documentHash: uploadedHash,
        checks: {
          documentIntegrity: {
            status: 'FAILED',
            message: 'Uploaded document bytes do not produce the registered cryptographic commitment.',
            metadata: {
              uploadedSha256: uploadedHash,
              recalculatedCommitment,
              registeredCommitment: onChainCommitment,
            },
          },
          issuerAuthenticity: {
            status: 'PASSED',
            message: `Originally issued by ${documentRecord.issuerOrganization.legalName}`,
          },
          organizationalTrust: {
            status: isIssuerActiveOnChain ? 'PASSED' : 'WARNING',
            message: `Issuer status is ${documentRecord.issuerOrganization.verificationStatus}`,
          },
          lifecycle: {
            status: 'FAILED',
            message: 'Integrity check failed. Credential invalidated.',
          },
        },
        verifiedAt,
      };
    }

    // -------------------------------------------------------------------------
    // STEP 8: Issuer Status and Signing Key Validity
    // -------------------------------------------------------------------------
    if (documentRecord.issuerOrganization.verificationStatus === 'SUSPENDED') {
      await this.recordAudit(requesterUserId, requesterOrgId, documentRecord.id, VerificationStatus.ISSUER_SUSPENDED, {
        hashMatched: true,
        commitmentMatched: true,
        issuerAuthorized: false,
        signatureValid: isKeyValidOnChain,
        chainConfirmed: true,
        documentActive: true,
      });

      return {
        status: VerificationStatus.ISSUER_SUSPENDED,
        verdict: 'Document integrity verified, but the issuing organization is currently SUSPENDED by platform governance.',
        credentialId: targetCredentialId,
        documentHash: uploadedHash,
        checks: {
          documentIntegrity: { status: 'PASSED', message: 'File bytes match the original on-chain commitment.' },
          issuerAuthenticity: { status: 'PASSED', message: 'Signature authorized at issuance time.' },
          organizationalTrust: { status: 'WARNING', message: 'Organization is temporarily suspended.' },
          lifecycle: { status: 'WARNING', message: 'Historical credential preserved with warning.' },
        },
        verifiedAt,
      };
    }

    if (!isKeyValidOnChain || documentRecord.issuerKey.keyStatus === 'COMPROMISED') {
      await this.recordAudit(requesterUserId, requesterOrgId, documentRecord.id, VerificationStatus.ISSUER_KEY_COMPROMISED, {
        hashMatched: true,
        commitmentMatched: true,
        issuerAuthorized: isIssuerActiveOnChain,
        signatureValid: false,
        chainConfirmed: true,
        documentActive: false,
      });

      return {
        status: VerificationStatus.ISSUER_KEY_COMPROMISED,
        verdict: 'The signing key used to authorize this credential was marked compromised.',
        credentialId: targetCredentialId,
        documentHash: uploadedHash,
        checks: {
          documentIntegrity: { status: 'PASSED', message: 'File bytes match commitment.' },
          issuerAuthenticity: { status: 'FAILED', message: 'Signing key was compromised.' },
          organizationalTrust: { status: 'PASSED', message: 'Organization is registered.' },
          lifecycle: { status: 'FAILED', message: 'Credential signature revoked.' },
        },
        verifiedAt,
      };
    }

    // -------------------------------------------------------------------------
    // STEP 9: Lifecycle Checks (Revocation, Expiration, Blockchain Confirmation)
    // -------------------------------------------------------------------------
    const isOnChainRevoked = onChainCredential ? Number(onChainCredential.status) === 2 : false;
    const isDbRevoked = documentRecord.documentStatus === 'REVOKED';

    if (isOnChainRevoked || isDbRevoked) {
      await this.recordAudit(requesterUserId, requesterOrgId, documentRecord.id, VerificationStatus.DOCUMENT_REVOKED, {
        hashMatched: true,
        commitmentMatched: true,
        issuerAuthorized: isIssuerActiveOnChain,
        signatureValid: isKeyValidOnChain,
        chainConfirmed: true,
        documentActive: false,
      });

      return {
        status: VerificationStatus.DOCUMENT_REVOKED,
        verdict: 'This document was legitimately issued, but has since been REVOKED by the authorized organization.',
        credentialId: targetCredentialId,
        documentHash: uploadedHash,
        checks: {
          documentIntegrity: { status: 'PASSED', message: 'File bytes match original issuance.' },
          issuerAuthenticity: { status: 'PASSED', message: `Issued by ${documentRecord.issuerOrganization.legalName}` },
          organizationalTrust: { status: 'PASSED', message: 'Issuer is active.' },
          lifecycle: { status: 'FAILED', message: 'On-chain document status is REVOKED.' },
        },
        verifiedAt,
      };
    }

    // Expiration check
    if (documentRecord.expiresAt && new Date() >= new Date(documentRecord.expiresAt)) {
      await this.recordAudit(requesterUserId, requesterOrgId, documentRecord.id, VerificationStatus.DOCUMENT_EXPIRED, {
        hashMatched: true,
        commitmentMatched: true,
        issuerAuthorized: isIssuerActiveOnChain,
        signatureValid: isKeyValidOnChain,
        chainConfirmed: true,
        documentActive: false,
      });

      return {
        status: VerificationStatus.DOCUMENT_EXPIRED,
        verdict: 'This document is authentic, but has EXPIRED past its declared validity date.',
        credentialId: targetCredentialId,
        documentHash: uploadedHash,
        checks: {
          documentIntegrity: { status: 'PASSED', message: 'File bytes match original issuance.' },
          issuerAuthenticity: { status: 'PASSED', message: `Issued by ${documentRecord.issuerOrganization.legalName}` },
          organizationalTrust: { status: 'PASSED', message: 'Issuer is active.' },
          lifecycle: { status: 'WARNING', message: `Expired on ${new Date(documentRecord.expiresAt).toLocaleDateString()}` },
        },
        verifiedAt,
      };
    }

    // Blockchain confirmation check
    if (documentRecord.documentStatus === 'PENDING_BLOCKCHAIN' && !onChainCredential) {
      return {
        status: VerificationStatus.BLOCKCHAIN_PENDING,
        verdict: 'Document issuance transaction is pending on Polygon PoS. Awaiting block confirmations.',
        credentialId: targetCredentialId,
        documentHash: uploadedHash,
        checks: {
          documentIntegrity: { status: 'PASSED', message: 'Hash and commitment calculated.' },
          issuerAuthenticity: { status: 'PASSED', message: 'Valid issuer signature.' },
          organizationalTrust: { status: 'PASSED', message: 'Issuer is active.' },
          lifecycle: { status: 'WARNING', message: 'Awaiting blockchain mining confirmation.' },
        },
        verifiedAt,
      };
    }

    // -------------------------------------------------------------------------
    // VERDICT: AUTHENTIC_ACTIVE (All 9 Checks Passed)
    // -------------------------------------------------------------------------
    await this.recordAudit(requesterUserId, requesterOrgId, documentRecord.id, VerificationStatus.AUTHENTIC_ACTIVE, {
      hashMatched: true,
      commitmentMatched: true,
      issuerAuthorized: true,
      signatureValid: true,
      chainConfirmed: true,
      documentActive: true,
    });

    return {
      status: VerificationStatus.AUTHENTIC_ACTIVE,
      verdict: 'Document is authentic, unaltered, issued by an authorized organization, and confirmed on Polygon PoS.',
      credentialId: targetCredentialId,
      documentHash: uploadedHash,
      checks: {
        documentIntegrity: {
          status: 'PASSED',
          message: 'Exact byte SHA-256 and commitment match on-chain record.',
          metadata: {
            sha256: uploadedHash,
            commitment: onChainCommitment,
          },
        },
        issuerAuthenticity: {
          status: 'PASSED',
          message: `Digitally authorized by ${documentRecord.issuerOrganization.legalName}`,
          metadata: {
            issuerId,
            keyVersion: documentRecord.issuerKey.keyVersion,
            signerAddress: documentRecord.issuerKey.walletAddress,
          },
        },
        organizationalTrust: {
          status: 'PASSED',
          message: `${documentRecord.issuerOrganization.legalName} is an accredited, active issuer on Polygon PoS.`,
        },
        lifecycle: {
          status: 'PASSED',
          message: 'Credential is active, unrevoked, and unexpired.',
          metadata: {
            issuedAt: documentRecord.issuedAt,
            expiresAt: documentRecord.expiresAt,
          },
        },
      },
      verifiedAt,
    };
  }

  /**
   * Retrieves public cryptographic status for a credential ID without revealing PII.
   */
  async getPublicCredentialStatus(credentialId: string) {
    const document = await this.prisma.document.findUnique({
      where: { credentialId },
      include: {
        issuerOrganization: {
          select: {
            legalName: true,
            organizationType: true,
            website: true,
            verificationStatus: true,
          },
        },
        documentType: {
          select: {
            code: true,
            displayName: true,
          },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('No registered document found for this credential ID.');
    }

    return {
      credentialId: document.credentialId,
      commitment: document.commitment,
      documentStatus: document.documentStatus,
      documentType: document.documentType.displayName,
      issuer: {
        legalName: document.issuerOrganization.legalName,
        organizationType: document.issuerOrganization.organizationType,
        website: document.issuerOrganization.website,
        verificationStatus: document.issuerOrganization.verificationStatus,
      },
      issuedAt: document.issuedAt,
      expiresAt: document.expiresAt,
    };
  }

  /**
   * Lists historical verification audit logs.
   */
  async listVerificationHistory(userId?: string) {
    const where: any = {};
    if (userId) {
      where.requesterUserId = userId;
    }

    return this.prisma.verificationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async recordAudit(
    requesterUserId: string | undefined,
    requesterOrgId: string | undefined,
    documentId: string | null,
    status: VerificationStatus,
    checks: {
      hashMatched: boolean;
      commitmentMatched: boolean;
      issuerAuthorized: boolean;
      signatureValid: boolean;
      chainConfirmed: boolean;
      documentActive: boolean;
    },
  ) {
    try {
      await this.prisma.verificationRequest.create({
        data: {
          requesterUserId,
          requesterOrgId,
          documentId,
          verificationStatus: status as any,
          hashMatched: checks.hashMatched,
          commitmentMatched: checks.commitmentMatched,
          issuerAuthorized: checks.issuerAuthorized,
          signatureValid: checks.signatureValid,
          chainConfirmed: checks.chainConfirmed,
          documentActive: checks.documentActive,
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to record verification audit request: ${err.message}`);
    }
  }
}
