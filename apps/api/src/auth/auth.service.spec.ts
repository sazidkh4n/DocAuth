import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { TotpUtil } from './utils/totp.util';

describe('AuthService - Authentication & Authorization Engine Unit Tests', () => {
  let authService: AuthService;
  let prismaMock: any;
  let jwtServiceMock: any;

  // In-memory mock database store
  const mockUsers: any[] = [];
  const mockSessions: any[] = [];

  beforeEach(async () => {
    mockUsers.length = 0;
    mockSessions.length = 0;

    prismaMock = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.email) {
            return Promise.resolve(mockUsers.find((u) => u.email === where.email.toLowerCase()) || null);
          }
          if (where.id) {
            return Promise.resolve(mockUsers.find((u) => u.id === where.id) || null);
          }
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation(({ data, select }) => {
          const newUser = {
            id: `usr_${Date.now()}_${Math.random()}`,
            ...data,
            accountStatus: 'ACTIVE',
            mfaEnabled: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            memberships: [],
          };
          mockUsers.push(newUser);
          if (select) {
            const result: any = {};
            for (const key of Object.keys(select)) {
              if (select[key]) result[key] = newUser[key];
            }
            return Promise.resolve(result);
          }
          return Promise.resolve(newUser);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const user = mockUsers.find((u) => u.id === where.id);
          if (user) {
            Object.assign(user, data);
            return Promise.resolve(user);
          }
          return Promise.resolve(null);
        }),
      },
      authSession: {
        create: jest.fn().mockImplementation(({ data }) => {
          const newSession = {
            id: `sess_${Date.now()}_${Math.random()}`,
            ...data,
            revokedAt: null,
            createdAt: new Date(),
          };
          mockSessions.push(newSession);
          return Promise.resolve(newSession);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          const session = mockSessions.find((s) => s.refreshTokenHash === where.refreshTokenHash);
          if (session) {
            const user = mockUsers.find((u) => u.id === session.userId);
            return Promise.resolve({ ...session, user });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const session = mockSessions.find((s) => s.id === where.id);
          if (session) {
            Object.assign(session, data);
            return Promise.resolve(session);
          }
          return Promise.resolve(null);
        }),
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          let count = 0;
          for (const s of mockSessions) {
            if (s.userId === where.userId) {
              Object.assign(s, data);
              count++;
            }
          }
          return Promise.resolve({ count });
        }),
      },
    };

    jwtServiceMock = {
      sign: jest.fn().mockReturnValue('mock.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtServiceMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: string) => defaultVal),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('1. Password Security (Argon2id)', () => {
    it('should hash passwords using Argon2id with OWASP parameters', async () => {
      const password = 'SuperSecurePassword#2026';
      const hash = await authService.hashPassword(password);

      expect(hash).toContain('$argon2id$');
      expect(await argon2.verify(hash, password)).toBe(true);
      expect(await argon2.verify(hash, 'WrongPassword')).toBe(false);
    });
  });

  describe('2. User Registration', () => {
    it('should successfully register a new user', async () => {
      const user = await authService.register({
        email: 'rahul.sharma@example.com',
        password: 'Password123!',
        displayName: 'Rahul Sharma',
      });

      expect(user.email).toBe('rahul.sharma@example.com');
      expect(user.displayName).toBe('Rahul Sharma');
      expect((user as any).passwordHash).toBeUndefined();
    });

    it('should reject registration if email already exists', async () => {
      await authService.register({
        email: 'rahul.sharma@example.com',
        password: 'Password123!',
        displayName: 'Rahul Sharma',
      });

      await expect(
        authService.register({
          email: 'RAHUL.SHARMA@example.com', // Case-insensitive duplicate
          password: 'AnotherPassword123!',
          displayName: 'Rahul S.',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('3. Login and Session Token Generation', () => {
    beforeEach(async () => {
      await authService.register({
        email: 'rahul.sharma@example.com',
        password: 'CorrectPassword#2026',
        displayName: 'Rahul Sharma',
      });
    });

    it('should authenticate valid credentials and issue tokens', async () => {
      const result = (await authService.login(
        {
          email: 'rahul.sharma@example.com',
          password: 'CorrectPassword#2026',
        },
        '192.168.1.1',
        'Mozilla/5.0',
      )) as any;

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toMatch(/^rt_[0-9a-f]{64}$/);
      expect(mockSessions.length).toBe(1);
    });

    it('should reject invalid password with UnauthorizedException', async () => {
      await expect(
        authService.login({
          email: 'rahul.sharma@example.com',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('4. Refresh Token Rotation & Reuse Detection', () => {
    it('should rotate refresh token and issue new access token', async () => {
      await authService.register({
        email: 'alice@example.com',
        password: 'Password123!',
        displayName: 'Alice',
      });

      const loginResult = (await authService.login({
        email: 'alice@example.com',
        password: 'Password123!',
      })) as any;

      const initialRefreshToken = loginResult.refreshToken;

      // Refresh session
      const refreshResult = await authService.refreshToken(initialRefreshToken);

      expect(refreshResult.accessToken).toBe('mock.jwt.token');
      expect(refreshResult.refreshToken).not.toBe(initialRefreshToken);
      expect(refreshResult.refreshToken).toMatch(/^rt_[0-9a-f]{64}$/);
    });

    it('should trigger breach mitigation if a revoked or consumed token is reused', async () => {
      await authService.register({
        email: 'bob@example.com',
        password: 'Password123!',
        displayName: 'Bob',
      });

      const loginResult = (await authService.login({
        email: 'bob@example.com',
        password: 'Password123!',
      })) as any;

      const token1 = loginResult.refreshToken;

      // Legitimate rotation (token1 -> token2)
      const rotateResult = await authService.refreshToken(token1);
      const token2 = rotateResult.refreshToken;

      // Attacker attempts to replay token1
      await expect(authService.refreshToken(token1)).rejects.toThrow(UnauthorizedException);

      // Verify that Bob's sessions have been invalidated as a safeguard
      const bobSessions = mockSessions.filter((s) => s.userId === loginResult.user.id);
      for (const sess of bobSessions) {
        expect(sess.revokedAt).not.toBeNull();
      }
    });
  });

  describe('5. Multi-Factor Authentication (TOTP)', () => {
    it('should generate TOTP secret and verify 6-digit codes', async () => {
      const secret = TotpUtil.generateSecret();
      expect(secret.length).toBeGreaterThan(16);

      const code = TotpUtil.generateCode(secret);
      expect(code).toMatch(/^[0-9]{6}$/);

      expect(TotpUtil.verifyCode(code, secret)).toBe(true);
      expect(TotpUtil.verifyCode('000000', secret)).toBe(false);
    });
  });
});
