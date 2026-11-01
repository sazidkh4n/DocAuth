import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Wallet, HDNodeWallet } from 'ethers';
import { DocumentsService } from './documents.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { EIP712_TYPES } from '@docauth/crypto';
import { OrgStatus, KeyStatus, DocumentStatus } from '@docauth/shared';

describe('Phase 5 & 6: Document Storage, Cryptography & Issuance Tests', () => {
  let docsService: DocumentsService;
  let signerWallet: HDNodeWallet;
  let attackerWallet: HDNodeWallet;

  const sampleOrgId = 'org_companya_123';
  const sampleIssuerId = '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';

  const mockDocs: any[] = [];
  const mockFileObjects: any[] = [];
  const mockOutbox: any[] = [];
  const mockStatusHistory: any[] = [];

  beforeEach(async () => {
    mockDocs.length = 0;
    mockFileObjects.length = 0;
    mockOutbox.length = 0;
    mockStatusHistory.length = 0;

    signerWallet = Wallet.createRandom();
    attackerWallet = Wallet.createRandom();

    const prismaMock = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
      organization: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === sampleOrgId) {
            return Promise.resolve({
              id: sampleOrgId,
              legalName: 'Company A Technologies',
              issuerId: sampleIssuerId,
              verificationStatus: OrgStatus.ACTIVE,
              issuerKeys: [
                {
                  id: 'key_v1_id',
                  keyVersion: 1,
                  walletAddress: signerWallet.address.toLowerCase(),
                  keyStatus: KeyStatus.ACTIVE,
                },
              ],
            });
          }
          return Promise.resolve(null);
        }),
      },
      fileObject: {
        create: jest.fn().mockImplementation(({ data }) => {
          const fo = { id: `fo_${Date.now()}_${Math.random()}`, ...data };
          mockFileObjects.push(fo);
          return Promise.resolve(fo);
        }),
      },
      documentType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'type_exp_letter', code: 'EXPERIENCE_LETTER', displayName: 'Experience Letter' }),
        create: jest.fn().mockResolvedValue({ id: 'type_exp_letter', code: 'EXPERIENCE_LETTER', displayName: 'Experience Letter' }),
      },
      credentialHolder: {
        create: jest.fn().mockImplementation(({ data }) => {
          return Promise.resolve({ id: `holder_${Date.now()}`, ...data });
        }),
      },
      document: {
        create: jest.fn().mockImplementation(({ data }) => {
          const doc = {
            id: `doc_${Date.now()}`,
            ...data,
            documentStatus: DocumentStatus.PENDING_BLOCKCHAIN,
            createdAt: new Date(),
          };
          mockDocs.push(doc);
          return Promise.resolve(doc);
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const doc = mockDocs.find((d) => d.id === where.id);
          if (doc) {
            return Promise.resolve({
              ...doc,
              issuerOrganization: { issuerId: sampleIssuerId },
              issuerKey: { walletAddress: signerWallet.address.toLowerCase() },
              fileObject: { objectKey: 'sample.enc' },
              statusHistory: [],
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const doc = mockDocs.find((d) => d.id === where.id);
          if (doc) {
            Object.assign(doc, data);
            return Promise.resolve(doc);
          }
          return Promise.resolve(null);
        }),
      },
      documentStatusHistory: {
        create: jest.fn().mockImplementation(({ data }) => {
          mockStatusHistory.push(data);
          return Promise.resolve(data);
        }),
      },
      outboxMessage: {
        create: jest.fn().mockImplementation(({ data }) => {
          mockOutbox.push(data);
          return Promise.resolve(data);
        }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user_admin' }),
      },
    };

    const storageMock = {
      permanentBucket: 'docauth-permanent-documents',
      uploadFile: jest.fn().mockResolvedValue('sample_object_key'),
      downloadFile: jest.fn().mockResolvedValue(Buffer.from('decrypted_file_content')),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/download/doc.enc'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FileStorageService, useValue: storageMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: string) => defaultVal),
          },
        },
      ],
    }).compile();

    docsService = module.get<DocumentsService>(DocumentsService);
  });

  it('1. should reject non-PDF file upload lacking %PDF- magic bytes', async () => {
    const maliciousBytes = Buffer.from('NOT_A_PDF_DOCUMENT_EXECUTABLE_SHELL');
    const sessionResult = await docsService.createUploadSession(sampleOrgId, {
      documentTypeCode: 'EXPERIENCE_LETTER',
      holderEmail: 'rahul.sharma@example.com',
      holderSubjectReference: 'EMP-8891',
    });

    await expect(
      docsService.processAndFinalizeUpload(sampleOrgId, sessionResult.uploadSessionId, maliciousBytes, {
        documentTypeCode: 'EXPERIENCE_LETTER',
        holderEmail: 'rahul.sharma@example.com',
        holderSubjectReference: 'EMP-8891',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('2. should process valid PDF, compute SHA-256, commitment, and construct EIP-712 payload', async () => {
    // Valid PDF buffer starting with %PDF- header
    const validPdfBytes = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
      Buffer.from('1.7 Experience Letter Rahul Sharma Junior Dev 2024-2026'),
    ]);

    const sessionResult = await docsService.createUploadSession(sampleOrgId, {
      documentTypeCode: 'EXPERIENCE_LETTER',
      holderEmail: 'rahul.sharma@example.com',
      holderSubjectReference: 'EMP-8891',
    });

    const finalizeResult = await docsService.processAndFinalizeUpload(
      sampleOrgId,
      sessionResult.uploadSessionId,
      validPdfBytes,
      {
        documentTypeCode: 'EXPERIENCE_LETTER',
        holderEmail: 'rahul.sharma@example.com',
        holderSubjectReference: 'EMP-8891',
      },
    );

    expect(finalizeResult.credentialId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(finalizeResult.commitment).toMatch(/^0x[0-9a-f]{64}$/);
    expect(finalizeResult.documentHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(finalizeResult.eip712Payload).toBeDefined();
    expect(finalizeResult.eip712Payload.message.issuerId).toBe(sampleIssuerId);
  });

  it('3. should accept valid EIP-712 signature from authorized issuer and enqueue blockchain task', async () => {
    const validPdfBytes = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
      Buffer.from('1.7 Experience Letter Rahul Sharma Junior Dev 2024-2026'),
    ]);

    const sessionResult = await docsService.createUploadSession(sampleOrgId, {
      documentTypeCode: 'EXPERIENCE_LETTER',
      holderEmail: 'rahul.sharma@example.com',
      holderSubjectReference: 'EMP-8891',
    });

    const finalizeResult = await docsService.processAndFinalizeUpload(
      sampleOrgId,
      sessionResult.uploadSessionId,
      validPdfBytes,
      {
        documentTypeCode: 'EXPERIENCE_LETTER',
        holderEmail: 'rahul.sharma@example.com',
        holderSubjectReference: 'EMP-8891',
      },
    );

    // Sign payload with authorized issuer key
    const domain = finalizeResult.eip712Payload.domain;
    const types = { IssueCredential: EIP712_TYPES.IssueCredential };
    const message = finalizeResult.eip712Payload.message;

    const signature = await signerWallet.signTypedData(domain, types, message);

    const issueResult = await docsService.issue(sampleOrgId, sessionResult.uploadSessionId, {
      signature,
    });

    expect(issueResult.status).toBe(DocumentStatus.PENDING_BLOCKCHAIN);
    expect(issueResult.qrCodeDataUrl).toContain('data:image/png;base64');
    expect(mockDocs.length).toBe(1);
    expect(mockOutbox.length).toBe(1);
    expect(mockOutbox[0].topic).toBe('blockchain-document-issuance');
  });

  it('4. should reject issuance if signature is forged by unauthorized attacker', async () => {
    const validPdfBytes = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
      Buffer.from('1.7 Experience Letter Rahul Sharma Junior Dev 2024-2026'),
    ]);

    const sessionResult = await docsService.createUploadSession(sampleOrgId, {
      documentTypeCode: 'EXPERIENCE_LETTER',
      holderEmail: 'rahul.sharma@example.com',
      holderSubjectReference: 'EMP-8891',
    });

    const finalizeResult = await docsService.processAndFinalizeUpload(
      sampleOrgId,
      sessionResult.uploadSessionId,
      validPdfBytes,
      {
        documentTypeCode: 'EXPERIENCE_LETTER',
        holderEmail: 'rahul.sharma@example.com',
        holderSubjectReference: 'EMP-8891',
      },
    );

    // Attacker signs payload
    const domain = finalizeResult.eip712Payload.domain;
    const types = { IssueCredential: EIP712_TYPES.IssueCredential };
    const message = finalizeResult.eip712Payload.message;

    const forgedSignature = await attackerWallet.signTypedData(domain, types, message);

    await expect(
      docsService.issue(sampleOrgId, sessionResult.uploadSessionId, {
        signature: forgedSignature,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
