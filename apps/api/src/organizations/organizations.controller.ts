import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { ApplyOrganizationDto, UpdateOrganizationDto, AddMemberDto } from './dto/apply-organization.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../common/guards/org-membership.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { OrgRole } from '@docauth/shared';

@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit application for organization verification' })
  @ApiResponse({ status: 201, description: 'Application submitted successfully' })
  async apply(
    @CurrentUser('id') userId: string,
    @Body() dto: ApplyOrganizationDto,
  ) {
    return this.organizationsService.apply(userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true, description: 'Active Organization ID' })
  @ApiOperation({ summary: 'Get current organization details' })
  async getMe(@Req() req: any) {
    return this.organizationsService.getMe(req.organization.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @OrgRoles(OrgRole.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true, description: 'Active Organization ID' })
  @ApiOperation({ summary: 'Update organization profile' })
  async update(
    @Req() req: any,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(req.organization.id, dto);
  }

  @Get('me/members')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true, description: 'Active Organization ID' })
  @ApiOperation({ summary: 'List members of the organization' })
  async getMembers(@Req() req: any) {
    return this.organizationsService.getMembers(req.organization.id);
  }

  @Post('me/members')
  @UseGuards(JwtAuthGuard, OrgMembershipGuard)
  @OrgRoles(OrgRole.ORG_ADMIN)
  @ApiBearerAuth()
  @ApiHeader({ name: 'X-Organization-Id', required: true, description: 'Active Organization ID' })
  @ApiOperation({ summary: 'Add a member to the organization' })
  async addMember(
    @Req() req: any,
    @Body() dto: AddMemberDto,
  ) {
    return this.organizationsService.addMember(req.organization.id, dto);
  }
}

