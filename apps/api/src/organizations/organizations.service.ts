import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ApplyOrganizationDto, UpdateOrganizationDto, AddMemberDto } from './dto/apply-organization.dto';
import { encryptAesGcm } from '@docauth/crypto';
import { OrgStatus, OrgRole, MembershipStatus } from '@docauth/shared';

@Injectable()
export class OrganizationsService {
  private readonly kmsMasterKey: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.kmsMasterKey = this.configService.get<string>(
      'KMS_MASTER_KEY_HEX',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  }

  /**
   * Submits a formal organization onboarding application with encrypted registration evidence.
   */
  async apply(userId: string, dto: ApplyOrganizationDto) {
    // Encrypt sensitive registration number
    const encryptedRegNum = JSON.stringify(encryptAesGcm(dto.registrationNumber, this.kmsMasterKey));

    // Use a transaction to create Organization, VerificationCase, and initial ORG_ADMIN membership
    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          legalName: dto.legalName,
          registrationNumberEncrypted: encryptedRegNum,
          organizationType: dto.organizationType as any,
          website: dto.website,
          verificationStatus: OrgStatus.PENDING as any,
        },
      });

      const verificationCase = await tx.organizationVerificationCase.create({
        data: {
          organizationId: organization.id,
          submittedBy: userId,
          reviewStatus: 'SUBMITTED',
        },
      });

      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId,
          role: OrgRole.ORG_ADMIN as any,
          status: MembershipStatus.ACTIVE as any,
        },
      });

      return {
        organization,
        verificationCase,
        membership,
      };
    });

    return {
      organizationId: result.organization.id,
      legalName: result.organization.legalName,
      status: result.organization.verificationStatus,
      caseId: result.verificationCase.id,
      submittedAt: result.verificationCase.submittedAt,
    };
  }

  /**
   * Retrieves organization details for the active tenant.
   */
  async getMe(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        issuerKeys: {
          select: {
            id: true,
            keyVersion: true,
            walletAddress: true,
            keyStatus: true,
            effectiveAt: true,
            revokedAt: true,
            compromisedAt: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return {
      id: org.id,
      issuerId: org.issuerId,
      legalName: org.legalName,
      organizationType: org.organizationType,
      website: org.website,
      verificationStatus: org.verificationStatus,
      issuerKeys: org.issuerKeys,
      createdAt: org.createdAt,
    };
  }

  /**
   * Updates organization profile fields.
   */
  async update(organizationId: string, dto: UpdateOrganizationDto) {
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        website: dto.website,
      },
    });

    return {
      id: updated.id,
      legalName: updated.legalName,
      website: updated.website,
      status: updated.verificationStatus,
    };
  }

  /**
   * Lists all members of the organization.
   */
  async getMembers(organizationId: string) {
    const members = await this.prisma.organizationMembership.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            accountStatus: true,
          },
        },
      },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      displayName: m.user.displayName,
      role: m.role,
      status: m.status,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * Adds or invites a user to the organization.
   */
  async addMember(organizationId: string, dto: AddMemberDto) {
    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!targetUser) {
      throw new NotFoundException(`No registered user found with email ${dto.email}`);
    }

    const existingMembership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization.');
    }

    const membership = await this.prisma.organizationMembership.create({
      data: {
        organizationId,
        userId: targetUser.id,
        role: dto.role as any,
        status: MembershipStatus.ACTIVE as any,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    return {
      id: membership.id,
      email: membership.user.email,
      displayName: membership.user.displayName,
      role: membership.role,
      status: membership.status,
    };
  }
}

