import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterSigningKeyDto, RotateSigningKeyDto, RevokeSigningKeyDto } from './dto/issuer-key.dto';
import { KeyStatus, OrgStatus } from '@docauth/shared';

@Injectable()
export class IssuerKeysService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lists all signing key versions for an organization.
   */
  async listKeys(organizationId: string) {
    return this.prisma.issuerKey.findMany({
      where: { organizationId },
      orderBy: { keyVersion: 'asc' },
    });
  }

  /**
   * Registers Key Version 1 for an approved organization.
   */
  async registerInitialKey(organizationId: string, dto: RegisterSigningKeyDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { issuerKeys: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    if (org.verificationStatus !== OrgStatus.APPROVED && org.verificationStatus !== OrgStatus.ACTIVE) {
      throw new BadRequestException('Organization must be approved by platform administrators before registering signing keys.');
    }

    if (org.issuerKeys.length > 0) {
      throw new ConflictException('Initial signing key is already registered. Use key rotation instead.');
    }

    return this.prisma.$transaction(async (tx) => {
      const key = await tx.issuerKey.create({
        data: {
          organizationId,
          keyVersion: 1,
          walletAddress: dto.walletAddress.toLowerCase(),
          keyStatus: KeyStatus.ACTIVE as any,
          effectiveAt: new Date(),
        },
      });

      // Update organization verificationStatus to ACTIVE if it was APPROVED
      if (org.verificationStatus === OrgStatus.APPROVED) {
        await tx.organization.update({
          where: { id: organizationId },
          data: { verificationStatus: OrgStatus.ACTIVE as any },
        });
      }

      // Enqueue blockchain outbox message
      if (org.issuerId) {
        await tx.outboxMessage.create({
          data: {
            topic: 'blockchain-key-addition',
            payload: {
              issuerId: org.issuerId,
              keyVersion: 1,
              walletAddress: key.walletAddress,
            },
          },
        });
      }

      return key;
    });
  }

  /**
   * Rotates signing key to version v + 1.
   */
  async rotateKey(organizationId: string, dto: RotateSigningKeyDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        issuerKeys: {
          orderBy: { keyVersion: 'desc' },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    if (org.issuerKeys.length === 0) {
      throw new BadRequestException('No existing signing key found to rotate. Register an initial key first.');
    }

    const latestKey = org.issuerKeys[0];
    const newVersion = latestKey.keyVersion + 1;

    return this.prisma.$transaction(async (tx) => {
      // Mark previous key as ROTATED if it was ACTIVE
      if (latestKey.keyStatus === KeyStatus.ACTIVE) {
        await tx.issuerKey.update({
          where: { id: latestKey.id },
          data: { keyStatus: KeyStatus.ROTATED as any },
        });
      }

      // Create new active key version
      const newKey = await tx.issuerKey.create({
        data: {
          organizationId,
          keyVersion: newVersion,
          walletAddress: dto.newWalletAddress.toLowerCase(),
          keyStatus: KeyStatus.ACTIVE as any,
          effectiveAt: new Date(),
        },
      });

      // Enqueue blockchain outbox message
      if (org.issuerId) {
        await tx.outboxMessage.create({
          data: {
            topic: 'blockchain-key-rotation',
            payload: {
              issuerId: org.issuerId,
              newKeyVersion: newVersion,
              walletAddress: newKey.walletAddress,
            },
          },
        });
      }

      return newKey;
    });
  }

  /**
   * Revokes a signing key version, recording potential compromise timestamps.
   */
  async revokeKey(organizationId: string, keyId: string, dto: RevokeSigningKeyDto) {
    const key = await this.prisma.issuerKey.findFirst({
      where: {
        id: keyId,
        organizationId,
      },
      include: { organization: true },
    });

    if (!key) {
      throw new NotFoundException('Signing key record not found for this organization.');
    }

    if (key.keyStatus === KeyStatus.REVOKED || key.keyStatus === KeyStatus.COMPROMISED) {
      throw new BadRequestException('Signing key is already revoked or marked compromised.');
    }

    const now = new Date();
    const newStatus = dto.isCompromised ? KeyStatus.COMPROMISED : KeyStatus.REVOKED;
    const compromisedAt = dto.compromisedAt ? new Date(dto.compromisedAt) : (dto.isCompromised ? now : null);

    return this.prisma.$transaction(async (tx) => {
      const updatedKey = await tx.issuerKey.update({
        where: { id: keyId },
        data: {
          keyStatus: newStatus as any,
          revokedAt: now,
          compromisedAt,
        },
      });

      if (key.organization.issuerId) {
        await tx.outboxMessage.create({
          data: {
            topic: 'blockchain-key-revocation',
            payload: {
              issuerId: key.organization.issuerId,
              keyVersion: key.keyVersion,
              compromiseTimestamp: compromisedAt ? Math.floor(compromisedAt.getTime() / 1000) : 0,
              reason: dto.reason,
            },
          },
        });
      }

      return updatedKey;
    });
  }
}

