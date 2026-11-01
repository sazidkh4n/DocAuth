import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { VerificationService } from './verification.service';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Verification')
@Controller()
export class VerificationController {
  constructor(private verificationService: VerificationService) {}

  @Post('verifications')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('document'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Independently verify an uploaded PDF document across all 3 trust dimensions',
  })
  @ApiResponse({ status: 200, description: 'Cryptographic verification report' })
  async verifyDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: VerifyDocumentDto,
    @Req() req: any,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('A PDF document file must be uploaded for verification.');
    }

    const userId = req.user?.id;
    const orgId = req.headers?.['x-organization-id'];

    return this.verificationService.verifyDocument(
      file.buffer,
      dto.credentialId,
      userId,
      orgId,
    );
  }

  @Get('public/verify/:credentialId')
  @ApiOperation({
    summary: 'Public cryptographic status lookup for a credential ID without revealing PII',
  })
  async getPublicStatus(@Param('credentialId') credentialId: string) {
    return this.verificationService.getPublicCredentialStatus(credentialId);
  }

  @Get('verifications/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List verification audit history for the caller' })
  async listHistory(@CurrentUser('id') userId: string) {
    return this.verificationService.listVerificationHistory(userId);
  }
}

