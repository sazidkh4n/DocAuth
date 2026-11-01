import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OrganizationsService } from './organizations.service';
import { AdminService } from '../admin/admin.service';
import { IssuerKeysService } from '../issuer-keys/issuer-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgType, OrgStatus, KeyStatus } from '@docauth/shared';

describe('Phase 3: Organization Onboarding & Key Management Tests', () => {
  let orgsService: OrganizationsService;
  let adminService: AdminService;
  let keysService: IssuerKeysService;

  const mockOrgs: any[] = [];
  const mockCases: any[] = [];
  const mockMembers: any[] = [];
  const mockKeys: any[] = [];
  const mockOutbox: any[] = [];

  beforeEach(async () => {
    mockOrgs.length = 0;
    mockCases.length = 0;
    mockMembers.length = 0;
    mockKeys.length = 0;
    mockOutbox.length = 0;

    const prismaMock = {
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(prismaMock);
      }),
      organization: {
        create: jest.fn().mockImplementation(({ data }) => {
          const org = {
            id: `org_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
            issuerKeys: [],
          };
          mockOrgs.push(org);
          return Promise.resolve(org);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const org = mockOrgs.find((o) => o.id === where.id);
          if (org) {
            const orgKeys = mockKeys.filter((k) => k.organizationId === org.id);
            return Promise.resolve({ ...org, issuerKeys: orgKeys });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const org = mockOrgs.find((o) => o.id === where.id);
          if (org) {
            Object.assign(org, data);
            return Promise.resolve(org);
          }
          return Promise.resolve(null);
        }),
      },
      organizationVerificationCase: {
        create: jest.fn().mockImplementation(({ data }) => {
          const vCase = {
            id: `case_${Date.now()}_${Math.random()}`,
            ...data,
            submittedAt: new Date(),
          };
          mockCases.push(vCase);
          return Promise.resolve(vCase);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const vCase = mockCases.find((c) => c.id === where.id);
          if (vCase) {
            const organization = mockOrgs.find((o) => o.id === vCase.organizationId);
            return Promise.resolve({ ...vCase, organization });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const vCase = mockCases.find((c) => c.id === where.id);
          if (vCase) {
            Object.assign(vCase, data);
            return Promise.resolve(vCase);
          }
          return Promise.resolve(null);
        }),
      },
      organizationMembership: {
        create: jest.fn().mockImplementation(({ data }) => {
          const m = { id: `mem_${Date.now()}_${Math.random()}`, ...data, createdAt: new Date() };
          mockMembers.push(m);
          return Promise.resolve(m);
        }),
      },
      issuerKey: {
        create: jest.fn().mockImplementation(({ data }) => {
          const key = { id: `key_${Date.now()}_${Math.random()}`, ...data };
          mockKeys.push(key);
          return Promise.resolve(key);
        }),
        findMany: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(mockKeys.filter((k) => k.organizationId === where.organizationId));
        }),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          const key = mockKeys.find((k) => k.id === where.id && k.organizationId === where.organizationId);
          if (key) {
            const organization = mockOrgs.find((o) => o.id === key.organizationId);
            return Promise.resolve({ ...key, organization });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const key = mockKeys.find((k) => k.id === where.id);
          if (key) {
            Object.assign(key, data);
            return Promise.resolve(key);
          }
          return Promise.resolve(null);
        }),
      },
      outboxMessage: {
        create: jest.fn().mockImplementation(({ data }) => {
          const msg = { id: `msg_${Date.now()}_${Math.random()}`, ...data, createdAt: new Date() };
          mockOutbox.push(msg);
          return Promise.resolve(msg);
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        AdminService,
        IssuerKeysService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: string) => defaultVal),
          },
        },
      ],
    }).compile();

    orgsService = module.get<OrganizationsService>(OrganizationsService);
    adminService = module.get<AdminService>(AdminService);
    keysService = module.get<IssuerKeysService>(IssuerKeysService);
  });

  it('1. should submit organization application with encrypted registration number', async () => {
    const applicantId = 'user_applicant_123';
    const appResult = await orgsService.apply(applicantId, {
      legalName: 'Apex University',
      registrationNumber: 'APEX-REG-2024-9901',
      organizationType: OrgType.UNIVERSITY,
      website: 'https://apex.edu',
      contactEmail: 'compliance@apex.edu',
    });

    expect(appResult.legalName).toBe('Apex University');
    expect(appResult.status).toBe(OrgStatus.PENDING);
    expect(mockOrgs.length).toBe(1);

    // Verify registration number was encrypted at rest
    const storedOrg = mockOrgs[0];
    expect(storedOrg.registrationNumberEncrypted).not.toContain('APEX-REG-2024-9901');
    expect(storedOrg.registrationNumberEncrypted).toContain('"iv"');
    expect(storedOrg.registrationNumberEncrypted).toContain('"ciphertext"');
  });

  it('2. should approve organization, generate opaque issuer ID, and create outbox task', async () => {
    const appResult = await orgsService.apply('user_123', {
      legalName: 'Apex University',
      registrationNumber: 'APEX-REG-2024-9901',
      organizationType: OrgType.UNIVERSITY,
      website: 'https://apex.edu',
      contactEmail: 'compliance@apex.edu',
    });

    const approvalResult = await adminService.approveOrganization(
      'admin_user_456',
      appResult.caseId,
      'Corporate registry records validated.',
    );

    expect(approvalResult.status).toBe(OrgStatus.APPROVED);
    expect(approvalResult.issuerId).toMatch(/^0x[0-9a-f]{64}$/);

    // Verify outbox message was created for blockchain relayer
    expect(mockOutbox.length).toBe(1);
    expect(mockOutbox[0].topic).toBe('blockchain-issuer-registration');
    expect(mockOutbox[0].payload.issuerId).toBe(approvalResult.issuerId);
  });

  it('3. should register initial signing key (Version 1) and activate organization', async () => {
    const appResult = await orgsService.apply('user_123', {
      legalName: 'Apex University',
      registrationNumber: 'APEX-REG-2024-9901',
      organizationType: OrgType.UNIVERSITY,
      website: 'https://apex.edu',
      contactEmail: 'compliance@apex.edu',
    });

    await adminService.approveOrganization('admin_456', appResult.caseId, 'Approved');

    const keyResult = await keysService.registerInitialKey(appResult.organizationId, {
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    });

    expect(keyResult.keyVersion).toBe(1);
    expect(keyResult.keyStatus).toBe(KeyStatus.ACTIVE);
    expect(keyResult.walletAddress).toBe('0x70997970c51812dc3a010c7d01b50e0d17dc79c8');

    // Organization should now be ACTIVE
    const org = await orgsService.getMe(appResult.organizationId);
    expect(org.verificationStatus).toBe(OrgStatus.ACTIVE);
  });

  it('4. should rotate signing key to Version 2 and mark previous key ROTATED', async () => {
    const appResult = await orgsService.apply('user_123', {
      legalName: 'Apex University',
      registrationNumber: 'APEX-REG-2024-9901',
      organizationType: OrgType.UNIVERSITY,
      website: 'https://apex.edu',
      contactEmail: 'compliance@apex.edu',
    });

    await adminService.approveOrganization('admin_456', appResult.caseId, 'Approved');
    await keysService.registerInitialKey(appResult.organizationId, {
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    });

    // Rotate to Key v2
    const rotated = await keysService.rotateKey(appResult.organizationId, {
      newWalletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    });

    expect(rotated.keyVersion).toBe(2);
    expect(rotated.keyStatus).toBe(KeyStatus.ACTIVE);

    // Verify key 1 was marked ROTATED
    const allKeys = await keysService.listKeys(appResult.organizationId);
    expect(allKeys.length).toBe(2);
    expect(allKeys[0].keyVersion).toBe(1);
    expect(allKeys[0].keyStatus).toBe(KeyStatus.ROTATED);
  });

  it('5. should revoke a key and record compromise timestamp', async () => {
    const appResult = await orgsService.apply('user_123', {
      legalName: 'Apex University',
      registrationNumber: 'APEX-REG-2024-9901',
      organizationType: OrgType.UNIVERSITY,
      website: 'https://apex.edu',
      contactEmail: 'compliance@apex.edu',
    });

    await adminService.approveOrganization('admin_456', appResult.caseId, 'Approved');
    const key1 = await keysService.registerInitialKey(appResult.organizationId, {
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    });

    const compromiseDate = '2026-10-25T00:00:00.000Z';
    const revoked = await keysService.revokeKey(appResult.organizationId, key1.id, {
      isCompromised: true,
      compromisedAt: compromiseDate,
      reason: 'Server leaked private key.',
    });

    expect(revoked.keyStatus).toBe(KeyStatus.COMPROMISED);
    expect(revoked.compromisedAt).toEqual(new Date(compromiseDate));
  });
});

