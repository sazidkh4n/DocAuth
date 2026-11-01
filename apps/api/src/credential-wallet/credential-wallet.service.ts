import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { ClaimCredentialDto } from './dto/credential-wallet.dto';

@Injectable()
export class CredentialWalletService {
  private readonly publicVerifyBaseUrl: string;

  constructor(
    private prisma: PrismaService,
    private storage: FileStorageService,
    private configService: ConfigService,
  ) {
    this.publicVerifyBaseUrl = this.configService.get<string>(
      'PUBLIC_VERIFICATION_URL',
      'http://localhost:3000/verify',
    );
  }

  /**
   * Claims a credential issued to an individual before they registered an account.
   */
  async claimCredential(userId: string, dto: ClaimCredentialDto) {
    const claimCodeHash = createHash('sha256').update(dto.claimInvitationCode.trim()).digest('hex');

    const holder = await this.prisma.credentialHolder.findUnique({
      where: { claimInvitationCodeHash: claimCodeHash },
      include: {
        documents: {
          include: {
            documentType: true,
            issuerOrganization: true,
          },
        },
      },
    });

    if (!holder) {
      throw new NotFoundException('Invalid or expired claim invitation code.');
    }

    if (holder.userId && holder.userId !== userId) {
      throw new ConflictException('This credential has already been claimed by another account.');
    }

    // Bind holder record to user account and consume the claim code
    await this.prisma.credentialHolder.update({
      where: { id: holder.id },
      data: {
        userId,
        claimInvitationCodeHash: null, // Consumed
      },
    });

    return {
      success: true,
      claimedDocumentsCount: holder.documents.length,
      documents: holder.documents.map((d) => ({
        id: d.id,
        credentialId: d.credentialId,
        documentType: d.documentType.displayName,
        issuerName: d.issuerOrganization.legalName,
        status: d.documentStatus,
      })),
    };
  }

  /**
   * Lists all credentials owned by the authenticated holder.
   */
  async listMyDocuments(userId: string, categoryCode?: string) {
    const holders = await this.prisma.credentialHolder.findMany({
      where: { userId },
      select: { id: true },
    });

    if (holders.length === 0) {
      return [];
    }

    const holderIds = holders.map((h) => h.id);

    const where: any = {
      holderId: { in: holderIds },
    };

    if (categoryCode) {
      where.documentType = { code: categoryCode };
    }

    const documents = await this.prisma.document.findMany({
      where,
      include: {
        documentType: true,
        issuerOrganization: {
          select: {
            legalName: true,
            organizationType: true,
            website: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return documents.map((doc) => ({
      id: doc.id,
      credentialId: doc.credentialId,
      commitment: doc.commitment,
      status: doc.documentStatus,
      category: doc.documentType.displayName,
      categoryCode: doc.documentType.code,
      issuer: {
        legalName: doc.issuerOrganization.legalName,
        organizationType: doc.issuerOrganization.organizationType,
        verificationStatus: doc.issuerOrganization.verificationStatus,
      },
      issuedAt: doc.issuedAt,
      expiresAt: doc.expiresAt,
      verificationUrl: `${this.publicVerifyBaseUrl}/${doc.credentialId}`,
    }));
  }

  /**
   * Retrieves full details for a holder's credential (with strict authorization check).
   * Test G enforcement: unauthorized users cannot download another holder's document.
   */
  async getMyDocument(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        holder: true,
        documentType: true,
        issuerOrganization: true,
        fileObject: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        verificationRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found.');
    }

    // Strict ownership verification: must match authenticated holder's user ID
    if (document.holder.userId !== userId) {
      throw new ForbiddenException('Access denied: You are not authorized to view or download this document.');
    }

    // Generate short-lived pre-signed download URL (5-minute expiration)
    const downloadUrl = await this.storage.getPresignedDownloadUrl(
      this.storage.permanentBucket,
      document.fileObject.objectKey,
      300,
    );

    // Generate QR code data URL
    const verificationUrl = `${this.publicVerifyBaseUrl}/${document.credentialId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 250,
    });

    return {
      id: document.id,
      credentialId: document.credentialId,
      commitment: document.commitment,
      status: document.documentStatus,
      category: document.documentType.displayName,
      issuer: {
        legalName: document.issuerOrganization.legalName,
        organizationType: document.issuerOrganization.organizationType,
      },
      issuedAt: document.issuedAt,
      expiresAt: document.expiresAt,
      downloadUrl,
      verificationUrl,
      qrCodeDataUrl,
      statusHistory: document.statusHistory,
      verificationHistory: document.verificationRequests.map((v) => ({
        id: v.id,
        status: v.verificationStatus,
        verifiedAt: v.createdAt,
      })),
    };
  }

  /**
   * Creates a time-limited, revocable document share grant.
   */
  async createShare(userId: string, documentId: string, expiresInHours: number, recipientEmail?: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { holder: true },
    });

    if (!document || document.holder.userId !== userId) {
      throw new ForbiddenException('You do not have permission to share this document.');
    }

    const rawToken = `share_${randomBytes(24).toString('hex')}`;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const share = await this.prisma.documentShare.create({
      data: {
        documentId,
        holderId: document.holderId,
        tokenHash,
        expiresAt,
      },
    });

    const shareUrl = `${this.publicVerifyBaseUrl}/${document.credentialId}?shareToken=${rawToken}`;

    return {
      shareId: share.id,
      shareToken: rawToken,
      shareUrl,
      expiresAt,
      recipientEmail,
    };
  }

  /**
   * Revokes an existing document share grant immediately.
   */
  async revokeShare(userId: string, documentId: string, shareId: string) {
    const share = await this.prisma.documentShare.findFirst({
      where: {
        id: shareId,
        documentId,
      },
      include: {
        holder: true,
      },
    });

    if (!share || share.holder.userId !== userId) {
      throw new ForbiddenException('Share grant not found or unauthorized.');
    }

    await this.prisma.documentShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });

    return { success: true, message: 'Share permission revoked successfully.' };
  }

  /**
   * Retrieves audit log of all verifications performed against a holder's document.
   */
  async getDocumentVerifications(userId: string, documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        holder: true,
        verificationRequests: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!document || document.holder.userId !== userId) {
      throw new ForbiddenException('Access denied: You are not authorized to view verification history for this document.');
    }

    return document.verificationRequests.map((v) => ({
      id: v.id,
      verificationStatus: v.verificationStatus,
      hashMatched: v.hashMatched,
      commitmentMatched: v.commitmentMatched,
      issuerAuthorized: v.issuerAuthorized,
      signatureValid: v.signatureValid,
      chainConfirmed: v.chainConfirmed,
      documentActive: v.documentActive,
      verifiedAt: v.createdAt,
    }));
  }
}
