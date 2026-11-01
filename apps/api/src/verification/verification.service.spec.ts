import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VerificationService } from './verification.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateSha256Sync,
  calculateCommitment,
  generateNonce,
  encryptAesGcm,
} from '@docauth/crypto';
import { VerificationStatus, COMMITMENT_VERSION } from '@docauth/shared';

describe('Phase 7: Authoritative Document Verification Engine Tests', () => {
  let verifyService: VerificationService;

  const masterKek = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const sampleIssuerId = '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff';
  const sampleCredentialId = '0x4a7e912300000000000000000000000000000000000000000000000000000001';

  // Original experience letter bytes
  const originalPdfBytes = Buffer.concat([
    Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    Buffer.from('Rahul Sharma - Designation: Junior Developer. Period: 2024-2026.'),
  ]);

  // Modified experience letter bytes (1 character change)
  const modifiedPdfBytes = Buffer.concat([
    Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
    Buffer.from('Rahul Sharma - Designation: Senior Developer. Period: 2023-2026.'),
  ]);

  const originalHash = calculateSha256Sync(originalPdfBytes);
  const nonce = generateNonce();
  const originalCommitment = calculateCommitment(
    COMMITMENT_VERSION,
    sampleCredentialId,
    sampleIssuerId,
    originalHash,
    nonce,
  );

  const mockDbDocs: any[] = [];
  const mockVerificationRequests: any[] = [];

  beforeEach(async () => {
    mockDbDocs.length = 0;
    mockVerificationRequests.length = 0;

    const encryptedNonceJson = JSON.stringify(encryptAesGcm(nonce, masterKek));

    const registeredDoc = {
      id: 'doc_rahul_exp',
      credentialId: sampleCredentialId,
      commitment: originalCommitment,
      encryptedNonce: encryptedNonceJson,
      documentStatus: 'ACTIVE',
      issuedAt: new Date(),
      expiresAt: null,
      issuerOrganization: {
        id: 'org_companya',
        issuerId: sampleIssuerId,
        legalName: 'Company A Technologies',
        verificationStatus: 'ACTIVE',
      },
      issuerKey: {
        id: 'key_v1',
        keyVersion: 1,
        walletAddress: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
        keyStatus: 'ACTIVE',
      },
      documentType: {
        code: 'EXPERIENCE_LETTER',
        displayName: 'Experience Letter',
      },
    };
    mockDbDocs.push(registeredDoc);

    const prismaMock = {
      document: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const doc = mockDbDocs.find((d) => d.credentialId === where.credentialId);
          return Promise.resolve(doc || null);
        }),
      },
      fileObject: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      verificationRequest: {
        create: jest.fn().mockImplementation(({ data }) => {
          mockVerificationRequests.push(data);
          return Promise.resolve(data);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: string) => defaultVal),
          },
        },
      ],
    }).compile();

    verifyService = module.get<VerificationService>(VerificationService);
    verifyService.setBlockchainClient(null); // Local testbed mode
  });

  it('1. Test A: should report AUTHENTIC_ACTIVE for unmodified original registered PDF', async () => {
    const result = await verifyService.verifyDocument(originalPdfBytes, sampleCredentialId);

    expect(result.status).toBe(VerificationStatus.AUTHENTIC_ACTIVE);
    expect(result.checks.documentIntegrity.status).toBe('PASSED');
    expect(result.checks.issuerAuthenticity.status).toBe('PASSED');
    expect(result.checks.organizationalTrust.status).toBe('PASSED');
    expect(result.checks.lifecycle.status).toBe('PASSED');
  });

  it('2. Test B: should detect tampering and return DOCUMENT_MODIFIED when 1 character is modified', async () => {
    const result = await verifyService.verifyDocument(modifiedPdfBytes, sampleCredentialId);

    expect(result.status).toBe(VerificationStatus.DOCUMENT_MODIFIED);
    expect(result.checks.documentIntegrity.status).toBe('FAILED');
    expect(result.verdict).toContain('DOCUMENT INTEGRITY FAILURE');
  });

  it('3. should return NOT_REGISTERED when document is not indexed and credentialId not found', async () => {
    const unindexedPdf = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
      Buffer.from('Unrelated Unregistered Document'),
    ]);

    const result = await verifyService.verifyDocument(unindexedPdf);

    expect(result.status).toBe(VerificationStatus.NOT_REGISTERED);
    expect(result.verdict).toContain('No registered credential found');
  });

  it('4. Test C: should return ISSUER_SUSPENDED when issuing company is suspended by governance', async () => {
    mockDbDocs[0].issuerOrganization.verificationStatus = 'SUSPENDED';

    const result = await verifyService.verifyDocument(originalPdfBytes, sampleCredentialId);

    expect(result.status).toBe(VerificationStatus.ISSUER_SUSPENDED);
    expect(result.checks.documentIntegrity.status).toBe('PASSED');
    expect(result.checks.organizationalTrust.status).toBe('WARNING');
  });

  it('5. Test D: should return DOCUMENT_REVOKED when document has been revoked on-chain', async () => {
    mockDbDocs[0].documentStatus = 'REVOKED';

    const result = await verifyService.verifyDocument(originalPdfBytes, sampleCredentialId);

    expect(result.status).toBe(VerificationStatus.DOCUMENT_REVOKED);
    expect(result.checks.lifecycle.status).toBe('FAILED');
  });

  it('6. Test F: should return ISSUER_KEY_COMPROMISED when signing key was breached', async () => {
    mockDbDocs[0].issuerKey.keyStatus = 'COMPROMISED';

    const result = await verifyService.verifyDocument(originalPdfBytes, sampleCredentialId);

    expect(result.status).toBe(VerificationStatus.ISSUER_KEY_COMPROMISED);
    expect(result.checks.issuerAuthenticity.status).toBe('FAILED');
  });

  it('7. Test H: should return VERIFICATION_UNAVAILABLE when Polygon RPC throws an error', async () => {
    // Inject failing blockchain client to simulate RPC failure
    const failingClientMock: any = {
      getDocumentRegistry: () => ({
        getCredential: () => Promise.reject(new Error('Connection to Polygon RPC timed out (ETIMEDOUT)')),
      }),
      getIssuerRegistry: () => ({
        isIssuerActive: () => Promise.reject(new Error('RPC Error')),
      }),
    };
    verifyService.setBlockchainClient(failingClientMock);

    // Set non-zero address to trigger live RPC branch
    (verifyService as any).documentRegistryAddress = '0x1234567890123456789012345678901234567890';

    const result = await verifyService.verifyDocument(originalPdfBytes, sampleCredentialId);

    expect(result.status).toBe(VerificationStatus.VERIFICATION_UNAVAILABLE);
    expect(result.verdict).toContain('Polygon PoS blockchain RPC is unreachable');
  });
});

