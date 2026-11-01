import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CredentialWalletService } from './credential-wallet.service';
import { ClaimCredentialDto, CreateShareDto } from './dto/credential-wallet.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Credential Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CredentialWalletController {
  constructor(private walletService: CredentialWalletService) {}

  @Get('documents')
  @ApiOperation({ summary: 'List all verified credentials owned by the authenticated holder' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by document category code' })
  @ApiResponse({ status: 200, description: 'List of owned credentials' })
  async listDocuments(
    @Req() req: any,
    @Query('category') category?: string,
  ) {
    return this.walletService.listMyDocuments(req.user.id, category);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Get full credential details, secure temporary download URL, and verification QR code' })
  @ApiResponse({ status: 200, description: 'Document details and temporary access link' })
  @ApiResponse({ status: 403, description: 'Forbidden: Access denied to another holder’s credential' })
  async getDocument(
    @Req() req: any,
    @Param('id') documentId: string,
  ) {
    return this.walletService.getMyDocument(req.user.id, documentId);
  }

  @Get('documents/:id/verifications')
  @ApiOperation({ summary: 'View historical verification audit trail for this document' })
  @ApiResponse({ status: 200, description: 'Verification attempts history' })
  async getDocumentVerifications(
    @Req() req: any,
    @Param('id') documentId: string,
  ) {
    return this.walletService.getDocumentVerifications(req.user.id, documentId);
  }

  @Post('claim')
  @ApiOperation({ summary: 'Claim an unlinked credential using a one-time invitation code' })
  @ApiResponse({ status: 200, description: 'Credential successfully bound to account' })
  @ApiResponse({ status: 404, description: 'Invalid or expired claim invitation code' })
  async claimCredential(
    @Req() req: any,
    @Body() dto: ClaimCredentialDto,
  ) {
    return this.walletService.claimCredential(req.user.id, dto);
  }

  @Post('documents/:id/shares')
  @ApiOperation({ summary: 'Create a time-limited, revocable share link for a credential' })
  @ApiResponse({ status: 201, description: 'Share link and token generated' })
  async createShare(
    @Req() req: any,
    @Param('id') documentId: string,
    @Body() dto: CreateShareDto,
  ) {
    return this.walletService.createShare(
      req.user.id,
      documentId,
      dto.expiresInHours || 24,
      dto.recipientEmail,
    );
  }

  @Delete('documents/:id/shares/:shareId')
  @ApiOperation({ summary: 'Revoke an existing share link immediately' })
  @ApiResponse({ status: 200, description: 'Share link revoked' })
  async revokeShare(
    @Req() req: any,
    @Param('id') documentId: string,
    @Param('shareId') shareId: string,
  ) {
    return this.walletService.revokeShare(req.user.id, documentId, shareId);
  }
}
