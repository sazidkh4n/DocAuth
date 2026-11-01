import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { IssuerKeysService } from './issuer-keys.service';
import { RegisterSigningKeyDto, RotateSigningKeyDto, RevokeSigningKeyDto } from './dto/issuer-key.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../common/guards/org-membership.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { OrgRole } from '@docauth/shared';

@ApiTags('Issuer Signing Keys')
@Controller('organizations/me/signing-keys')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
@OrgRoles(OrgRole.ORG_ADMIN)
@ApiBearerAuth()
@ApiHeader({ name: 'X-Organization-Id', required: true, description: 'Active Organization ID' })
export class IssuerKeysController {
  constructor(private issuerKeysService: IssuerKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List all signing keys for current organization' })
  async listKeys(@Req() req: any) {
    return this.issuerKeysService.listKeys(req.organization.id);
  }

  @Post()
  @ApiOperation({ summary: 'Register initial signing key (Version 1)' })
  @ApiResponse({ status: 201, description: 'Signing key registered' })
  async registerInitialKey(
    @Req() req: any,
    @Body() dto: RegisterSigningKeyDto,
  ) {
    return this.issuerKeysService.registerInitialKey(req.organization.id, dto);
  }

  @Post('rotate')
  @ApiOperation({ summary: 'Rotate signing key to next version' })
  @ApiResponse({ status: 201, description: 'Signing key rotated' })
  async rotateKey(
    @Req() req: any,
    @Body() dto: RotateSigningKeyDto,
  ) {
    return this.issuerKeysService.rotateKey(req.organization.id, dto);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke or mark a signing key version compromised' })
  async revokeKey(
    @Req() req: any,
    @Param('id') keyId: string,
    @Body() dto: RevokeSigningKeyDto,
  ) {
    return this.issuerKeysService.revokeKey(req.organization.id, keyId, dto);
  }
}

