import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgRole, MembershipStatus } from '@docauth/shared';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User authentication context required.');
    }

    // Extract target organization ID from headers or route parameters
    const orgId =
      request.headers['x-organization-id'] ||
      request.params?.organizationId ||
      request.params?.orgId ||
      request.body?.organizationId;

    if (!orgId) {
      throw new BadRequestException('Organization identifier (X-Organization-Id header) is required for tenant-scoped operations.');
    }

    // Verify membership in database
    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: user.id,
        },
      },
      include: {
        organization: true,
      },
    });

    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You do not have an active membership in the specified organization.');
    }

    // Check role requirements if specified
    const requiredRoles = this.reflector.getAllAndOverride<OrgRole[]>(ORG_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.includes(membership.role as unknown as OrgRole);
      if (!hasRequiredRole) {
        throw new ForbiddenException(`Insufficient organization role. Required one of: ${requiredRoles.join(', ')}`);
      }
    }

    // Attach active membership and organization to request for controllers to use safely
    request.organizationMembership = membership;
    request.organization = membership.organization;

    return true;
  }
}

