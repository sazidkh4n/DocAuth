import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';
import { ReviewDecisionDto, SuspendOrganizationDto } from './dto/review-decision.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@docauth/shared';

@ApiTags('Platform Administration')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private adminService: AdminService,
    private auditService: AuditService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregated platform observability statistics' })
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Query platform immutable audit logs' })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('resourceType') resourceType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.queryLogs({
      action,
      resourceType,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post('emergency/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger emergency pause on Polygon smart contracts' })
  async emergencyPause(
    @CurrentUser('id') adminUserId: string,
    @Body('reason') reason: string,
  ) {
    return this.adminService.triggerEmergencyPause(adminUserId, reason || 'Administrative emergency stop');
  }

  @Post('emergency/unpause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpause Polygon smart contracts' })
  async emergencyUnpause(
    @CurrentUser('id') adminUserId: string,
  ) {
    return this.adminService.triggerEmergencyUnpause(adminUserId);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'List organization applications' })
  @ApiQuery({ name: 'status', required: false, enum: ['SUBMITTED', 'IN_REVIEW', 'DECIDED'] })
  async listApplications(@Query('status') status?: string) {
    return this.adminService.listApplications(status);
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Get full verification case details' })
  async getApplication(@Param('id') caseId: string) {
    return this.adminService.getApplication(caseId);
  }

  @Post('organizations/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve organization application and provision issuer ID' })
  async approveOrganization(
    @CurrentUser('id') adminUserId: string,
    @Param('id') caseId: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.adminService.approveOrganization(adminUserId, caseId, dto.reviewerNotes);
  }

  @Post('organizations/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject organization application' })
  async rejectOrganization(
    @CurrentUser('id') adminUserId: string,
    @Param('id') caseId: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.adminService.rejectOrganization(adminUserId, caseId, dto.reviewerNotes);
  }

  @Post('organizations/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend an organization' })
  async suspendOrganization(
    @Param('id') organizationId: string,
    @Body() dto: SuspendOrganizationDto,
  ) {
    return this.adminService.suspendOrganization(organizationId, dto.reason);
  }

  @Post('organizations/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a suspended organization' })
  async reactivateOrganization(@Param('id') organizationId: string) {
    return this.adminService.reactivateOrganization(organizationId);
  }
}
