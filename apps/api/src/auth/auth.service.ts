import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TotpUtil } from './utils/totp.util';
import { encryptAesGcm, decryptAesGcm } from '@docauth/crypto';

@Injectable()
export class AuthService {
  private readonly kmsMasterKey: string;
  private readonly refreshExpiresInDays = 7;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.kmsMasterKey = this.configService.get<string>(
      'KMS_MASTER_KEY_HEX',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  }

  /**
   * Hashes a password using Argon2id with OWASP-recommended parameters.
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,       // 3 iterations
      parallelism: 4,    // 4 threads
    });
  }

  /**
   * Registers a new user.
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const passwordHash = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        displayName: dto.displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        accountStatus: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });

    return user;
  }

  /**
   * Authenticates user credentials and provisions access and refresh tokens.
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          select: {
            organizationId: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.accountStatus !== 'ACTIVE') {
      throw new UnauthorizedException('This account has been suspended or locked.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Check if MFA is required
    if (user.mfaEnabled) {
      const mfaToken = this.jwtService.sign(
        { sub: user.id, isMfaPending: true },
        { expiresIn: '5m' },
      );
      return {
        mfaRequired: true,
        mfaToken,
        user: {
          id: user.id,
          email: user.email,
        },
      };
    }

    return this.createSessionAndTokens(user, ipAddress, userAgent);
  }

  /**
   * Refreshes an access token using rotating refresh tokens with automatic reuse detection.
   */
  async refreshToken(refreshToken: string, ipAddress?: string, userAgent?: string) {
    const refreshTokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
              select: {
                organizationId: true,
                role: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Reuse detection: If token was previously revoked or consumed, trigger breach mitigation
    if (!session || session.revokedAt !== null || session.expiresAt < new Date()) {
      if (session && session.revokedAt !== null) {
        // Active reuse detected! Invalidate all sessions for this compromised user
        await this.prisma.authSession.updateMany({
          where: { userId: session.userId },
          data: { revokedAt: new Date() },
        });
      }
      throw new UnauthorizedException('Refresh token is invalid, expired, or was already consumed.');
    }

    // Mark current session as consumed/revoked
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Create a new session for the rotated refresh token
    const newRefreshToken = `rt_${randomBytes(32).toString('hex')}`;
    const newRefreshTokenHash = this.hashToken(newRefreshToken);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + this.refreshExpiresInDays);

    const newSession = await this.prisma.authSession.create({
      data: {
        userId: session.user.id,
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
        ipAddress: ipAddress || session.ipAddress,
        userAgent: userAgent || session.userAgent,
      },
    });

    const accessToken = this.signAccessToken(session.user.id, session.user.email, newSession.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900, // 15m
      user: {
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        accountStatus: session.user.accountStatus,
        memberships: session.user.memberships,
      },
    };
  }

  /**
   * Revokes an active session upon logout.
   */
  async logout(sessionId: string) {
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { success: true, message: 'Logged out successfully.' };
  }

  /**
   * Initiates TOTP MFA enrollment: generates secret and QR code.
   */
  async enableMfa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const totpSecret = TotpUtil.generateSecret();
    const otpAuthUrl = TotpUtil.getOtpAuthUrl('DocAuthPlatform', user.email, totpSecret);

    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    // Encrypt secret with KMS master key before storing
    const encrypted = encryptAesGcm(totpSecret, this.kmsMasterKey);
    const serializedEncrypted = JSON.stringify(encrypted);

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEncrypted: serializedEncrypted },
    });

    return {
      secret: totpSecret,
      qrCodeDataUrl,
    };
  }

  /**
   * Confirms TOTP MFA enrollment or authenticates an MFA login challenge.
   */
  async verifyMfa(userId: string, code: string, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          select: {
            organizationId: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!user || !user.mfaSecretEncrypted) {
      throw new BadRequestException('MFA has not been initiated for this account.');
    }

    const encrypted = JSON.parse(user.mfaSecretEncrypted);
    const totpSecret = decryptAesGcm(encrypted, this.kmsMasterKey).toString('utf-8');

    const isValid = TotpUtil.verifyCode(code, totpSecret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired MFA code.');
    }

    if (!user.mfaEnabled) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      });
    }

    return this.createSessionAndTokens(user, ipAddress, userAgent);
  }

  private async createSessionAndTokens(user: any, ipAddress?: string, userAgent?: string) {
    const refreshToken = `rt_${randomBytes(32).toString('hex')}`;
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiresInDays);

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    const accessToken = this.signAccessToken(user.id, user.email, session.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        accountStatus: user.accountStatus,
        mfaEnabled: user.mfaEnabled,
        memberships: user.memberships,
      },
    };
  }

  private signAccessToken(userId: string, email: string, sessionId: string): string {
    return this.jwtService.sign(
      {
        sub: userId,
        email,
        sessionId,
      },
      {
        expiresIn: '15m',
      },
    );
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
