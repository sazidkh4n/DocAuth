import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateIssuerId } from '@docauth/crypto';
import { OrgStatus } from '@docauth/shared';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lists all organization verification applications.
   */
  async listApplications(status?: string) {
    const where: any = {};
    if (status) {
      where.reviewStatus = status;
    }

    return this.prisma.organizationVerificationCase.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            legalName: true,
            organizationType: true,
            website: true,
            verificationStatus: true,
            createdAt: true,
          },
        },
        submitter: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /**
   * Retrieves full application dossier.
   */
  async getApplication(caseId: string) {
    const verificationCase = await this.prisma.organizationVerificationCase.findUnique({
      where: { id: caseId },
      include: {
        organization: true,
        submitter: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        evidenceFiles: {
          include: {
            fileObject: true,
          },
        },
      },
    });

    if (!verificationCase) {
      throw new NotFoundException('Verification case not found.');
    }

    return verificationCase;
  }

  /**
   * Approves an organization: generates opaque issuerId, updates status, and queues on-chain registration.
   */
  async approveOrganization(adminUserId: string, caseId: string, reviewerNotes: string) {
    const verificationCase = await this.prisma.organizationVerificationCase.findUnique({
      where: { id: caseId },
      include: { organization: true },
    });

    if (!verificationCase) {
      throw new NotFoundException('Verification case not found.');
    }

    if (verificationCase.organization.verificationStatus === OrgStatus.ACTIVE ||
        verificationCase.organization.verificationStatus === OrgStatus.APPROVED) {
      throw new BadRequestException('Organization is already approved or active.');
    }

    // 1. Generate opaque 32-byte issuerId
    const issuerId = generateIssuerId();

    return this.prisma.$transaction(async (tx) => {
      // 2. Update organization with issuerId and APPROVED status
      const updatedOrg = await tx.organization.update({
        where: { id: verificationCase.organizationId },
        data: {
          issuerId,
          verificationStatus: OrgStatus.APPROVED as any,
        },
      });

      // 3. Update verification case decision
      await tx.organizationVerificationCase.update({
        where: { id: caseId },
        data: {
          assignedReviewer: adminUserId,
          reviewStatus: 'DECIDED',
          decision: 'APPROVED',
          reviewerNotes,
          reviewedAt: new Date(),
        },
      });

      // 4. Create Transactional Outbox task for background blockchain relayer
      await tx.outboxMessage.create({
        data: {
          topic: 'blockchain-issuer-registration',
          payload: {
            organizationId: updatedOrg.id,
            issuerId,
            legalName: updatedOrg.legalName,
          },
        },
      });

      return {
        organizationId: updatedOrg.id,
        issuerId,
        legalName: updatedOrg.legalName,
        status: updatedOrg.verificationStatus,
        decision: 'APPROVED',
      };
    });
  }

  /**
   * Rejects an organization application.
   */
  async rejectOrganization(adminUserId: string, caseId: string, reviewerNotes: string) {
    const verificationCase = await this.prisma.organizationVerificationCase.findUnique({
      where: { id: caseId },
    });

    if (!verificationCase) {
      throw new NotFoundException('Verification case not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: verificationCase.organizationId },
        data: { verificationStatus: OrgStatus.REJECTED as any },
      });

      await tx.organizationVerificationCase.update({
        where: { id: caseId },
        data: {
          assignedReviewer: adminUserId,
          reviewStatus: 'DECIDED',
          decision: 'REJECTED',
          reviewerNotes,
          reviewedAt: new Date(),
        },
      });

      return { success: true, decision: 'REJECTED' };
    });
  }

  /**
   * Suspends an organization.
   */
  async suspendOrganization(organizationId: string, reason: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: { verificationStatus: OrgStatus.SUSPENDED as any },
      });

      if (org.issuerId) {
        await tx.outboxMessage.create({
          data: {
            topic: 'blockchain-issuer-status-update',
            payload: {
              issuerId: org.issuerId,
              status: 'SUSPENDED',
              reason,
            },
          },
        });
      }

      return updated;
    });
  }

  /**
   * Reactivates a suspended organization.
   */
  async reactivateOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: { verificationStatus: OrgStatus.ACTIVE as any },
      });

      if (org.issuerId) {
        await tx.outboxMessage.create({
          data: {
            topic: 'blockchain-issuer-status-update',
            payload: {
              issuerId: org.issuerId,
              status: 'ACTIVE',
            },
          },
        });
      }

      return updated;
    });
  }

  /**
   * Returns aggregated platform observability statistics.
   */
  async getPlatformStats() {
    const [
      totalOrgs,
      activeOrgs,
      pendingOrgs,
      suspendedOrgs,
      totalDocuments,
      activeDocuments,
      revokedDocuments,
      totalVerifications,
      authenticVerifications,
      tamperedVerifications,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { verificationStatus: 'ACTIVE' } }),
      this.prisma.organization.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.organization.count({ where: { verificationStatus: 'SUSPENDED' } }),
      this.prisma.document.count(),
      this.prisma.document.count({ where: { documentStatus: 'ACTIVE' } }),
      this.prisma.document.count({ where: { documentStatus: 'REVOKED' } }),
      this.prisma.verificationRequest.count(),
      this.prisma.verificationRequest.count({ where: { verificationStatus: 'AUTHENTIC_ACTIVE' } }),
      this.prisma.verificationRequest.count({ where: { verificationStatus: 'DOCUMENT_MODIFIED' } }),
    ]);

    return {
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        pending: pendingOrgs,
        suspended: suspendedOrgs,
      },
      documents: {
        total: totalDocuments,
        active: activeDocuments,
        revoked: revokedDocuments,
      },
      verifications: {
        total: totalVerifications,
        authentic: authenticVerifications,
        tamperedOrFailed: tamperedVerifications,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Triggers emergency contract pause on Polygon.
   */
  async triggerEmergencyPause(adminUserId: string, reason: string) {
    const outbox = await this.prisma.outboxMessage.create({
      data: {
        topic: 'blockchain-emergency-pause',
        payload: {
          adminUserId,
          action: 'PAUSE',
          reason,
          timestamp: Date.now(),
        },
      },
    });

    return {
      success: true,
      message: 'Emergency pause order enqueued for blockchain dispatch.',
      outboxId: outbox.id,
    };
  }

  /**
   * Triggers emergency contract unpause on Polygon.
   */
  async triggerEmergencyUnpause(adminUserId: string) {
    const outbox = await this.prisma.outboxMessage.create({
      data: {
        topic: 'blockchain-emergency-unpause',
        payload: {
          adminUserId,
          action: 'UNPAUSE',
          timestamp: Date.now(),
        },
      },
    });

    return {
      success: true,
      message: 'Emergency unpause order enqueued for blockchain dispatch.',
      outboxId: outbox.id,
    };
  }
}
