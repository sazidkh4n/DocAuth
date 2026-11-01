import { Test, TestingModule } from '@nestjs/testing';
import { CredentialWalletService } from './credential-wallet.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';

describe('CredentialWalletService', () => {
  let service: CredentialWalletService;
  let prismaMock: any;
  let storageMock: any;
  let configMock: any;

  beforeEach(async () => {
    prismaMock = {
      credentialHolder: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      document: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      documentShare: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    storageMock = {
      permanentBucket: 'permanent-documents',
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.docauth.internal/presigned-url-12345'),
    };

    configMock = {
      get: jest.fn().mockImplementation((key, defaultVal) => defaultVal),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CredentialWalletService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FileStorageService, useValue: storageMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<CredentialWalletService>(CredentialWalletService);
  });

  describe('claimCredential', () => {
    it('should successfully claim credential using valid invitation code', async () => {
      const invitationCode = 'INV-999-SECRET';
      const codeHash = createHash('sha256').update(invitationCode).digest('hex');

      prismaMock.credentialHolder.findUnique.mockResolvedValue({
        id: 'holder-1',
        userId: null,
        claimInvitationCodeHash: codeHash,
        documents: [
          {
            id: 'doc-1',
            credentialId: '0xcred1',
            documentStatus: 'ACTIVE',
            documentType: { displayName: 'Experience Letter' },
            issuerOrganization: { legalName: 'Company A Ltd' },
          },
        ],
      });

      prismaMock.credentialHolder.update.mockResolvedValue({
        id: 'holder-1',
        userId: 'user-rahul-123',
        claimInvitationCodeHash: null,
      });

      const result = await service.claimCredential('user-rahul-123', {
        claimInvitationCode: invitationCode,
      });

      expect(result.success).toBe(true);
      expect(result.claimedDocumentsCount).toBe(1);
      expect(prismaMock.credentialHolder.update).toHaveBeenCalledWith({
        where: { id: 'holder-1' },
        data: { userId: 'user-rahul-123', claimInvitationCodeHash: null },
      });
    });

    it('should throw NotFoundException if invitation code does not exist', async () => {
      prismaMock.credentialHolder.findUnique.mockResolvedValue(null);

      await expect(
        service.claimCredential('user-rahul-123', {
          claimInvitationCode: 'INVALID-CODE',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if already claimed by another user', async () => {
      prismaMock.credentialHolder.findUnique.mockResolvedValue({
        id: 'holder-1',
        userId: 'different-user-456',
        documents: [],
      });

      await expect(
        service.claimCredential('user-rahul-123', {
          claimInvitationCode: 'ANY-CODE',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listMyDocuments', () => {
    it('should return empty list if user has no holder records', async () => {
      prismaMock.credentialHolder.findMany.mockResolvedValue([]);
      const result = await service.listMyDocuments('user-rahul-123');
      expect(result).toEqual([]);
    });

    it('should return categorized list of owned documents', async () => {
      prismaMock.credentialHolder.findMany.mockResolvedValue([{ id: 'holder-1' }]);
      prismaMock.document.findMany.mockResolvedValue([
        {
          id: 'doc-1',
          credentialId: '0xcred1',
          commitment: '0xcomm1',
          documentStatus: 'ACTIVE',
          issuedAt: new Date('2026-01-01'),
          expiresAt: null,
          documentType: { displayName: 'Degree Certificate', code: 'DEGREE' },
          issuerOrganization: {
            legalName: 'State Technical University',
            organizationType: 'UNIVERSITY',
            verificationStatus: 'ACTIVE',
          },
        },
      ]);

      const result = await service.listMyDocuments('user-rahul-123', 'DEGREE');

      expect(result).toHaveLength(1);
      expect(result[0].credentialId).toBe('0xcred1');
      expect(result[0].categoryCode).toBe('DEGREE');
      expect(result[0].issuer.legalName).toBe('State Technical University');
    });
  });

  describe('getMyDocument (Test G: Access Control Enforcement)', () => {
    it('should return document details, pre-signed URL and QR code if caller is the document holder', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        credentialId: '0xcred1',
        commitment: '0xcomm1',
        documentStatus: 'ACTIVE',
        issuedAt: new Date('2026-01-01'),
        expiresAt: null,
        holder: { userId: 'user-rahul-123' },
        documentType: { displayName: 'Experience Letter' },
        issuerOrganization: { legalName: 'Company A Ltd', organizationType: 'COMPANY' },
        fileObject: { objectKey: 'enc/companyA/doc-1.bin' },
        statusHistory: [],
        verificationRequests: [],
      });

      const result = await service.getMyDocument('user-rahul-123', 'doc-1');

      expect(result.id).toBe('doc-1');
      expect(result.downloadUrl).toBe('https://storage.docauth.internal/presigned-url-12345');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should throw ForbiddenException if user attempts to access another holder document (Test G)', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        credentialId: '0xcred1',
        holder: { userId: 'legitimate-holder-user-999' },
        fileObject: { objectKey: 'enc/companyA/doc-1.bin' },
      });

      // Attacker 'adversary-user-666' attempts to access Rahul's document
      await expect(
        service.getMyDocument('adversary-user-666', 'doc-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if document does not exist', async () => {
      prismaMock.document.findUnique.mockResolvedValue(null);

      await expect(
        service.getMyDocument('user-rahul-123', 'non-existent-doc'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createShare & revokeShare', () => {
    it('should allow legitimate holder to create time-limited share grant', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        credentialId: '0xcred1',
        holderId: 'holder-1',
        holder: { userId: 'user-rahul-123' },
      });

      prismaMock.documentShare.create.mockResolvedValue({
        id: 'share-abc-123',
        documentId: 'doc-1',
        holderId: 'holder-1',
        tokenHash: 'hash...',
        expiresAt: new Date(),
      });

      const result = await service.createShare('user-rahul-123', 'doc-1', 48, 'hr@companyb.com');

      expect(result.shareId).toBe('share-abc-123');
      expect(result.shareToken).toMatch(/^share_[0-9a-f]{48}$/);
      expect(result.recipientEmail).toBe('hr@companyb.com');
    });

    it('should throw ForbiddenException if unauthorized user attempts to share document', async () => {
      prismaMock.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        holder: { userId: 'user-rahul-123' },
      });

      await expect(
        service.createShare('attacker-user', 'doc-1', 24),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow holder to revoke existing share grant', async () => {
      prismaMock.documentShare.findFirst.mockResolvedValue({
        id: 'share-1',
        documentId: 'doc-1',
        holder: { userId: 'user-rahul-123' },
      });

      prismaMock.documentShare.update.mockResolvedValue({
        id: 'share-1',
        revokedAt: new Date(),
      });

      const result = await service.revokeShare('user-rahul-123', 'doc-1', 'share-1');

      expect(result.success).toBe(true);
      expect(prismaMock.documentShare.update).toHaveBeenCalledWith({
        where: { id: 'share-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException if user attempts to revoke someone else share grant', async () => {
      prismaMock.documentShare.findFirst.mockResolvedValue({
        id: 'share-1',
        documentId: 'doc-1',
        holder: { userId: 'legitimate-holder' },
      });

      await expect(
        service.revokeShare('attacker-user', 'doc-1', 'share-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});

