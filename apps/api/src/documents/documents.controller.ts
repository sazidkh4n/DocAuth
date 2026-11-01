import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader, ApiConsumes } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import {
  CreateUploadSessionDto,
  IssueDocumentDto,
  RevokeDocumentDto,
} from './dto/documents.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrgMembershipGuard } from '../common/guards/org-membership.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { OrgRole } from '@docauth/shared';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard, OrgMembershipGuard)
@OrgRoles(OrgRole.ORG_ADMIN, OrgRole.ISSUER)
@ApiBearerAuth()
@ApiHeader({ name: 'X-Organization-Id', required: true, description: 'Active Organization ID' })
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Post('upload-session')
  @ApiOperation({ summary: 'Initiate a new document issuance session' })
  @ApiResponse({ status: 201, description: 'Upload session initialized' })
  async createUploadSession(
    @Req() req: any,
    @Body() dto: CreateUploadSessionDto,
  ) {
    return this.documentsService.createUploadSession(req.organization.id, dto);
  }

  @Post(':uploadSessionId/finalize-upload')
  @UseInterceptors(FileInterceptor('document'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload PDF bytes, validate, calculate hashes & commitments, and receive EIP-712 payload' })
  async finalizeUpload(
    @Req() req: any,
    @Param('uploadSessionId') uploadSessionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateUploadSessionDto,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Document PDF file is required.');
    }
    return this.documentsService.processAndFinalizeUpload(
      req.organization.id,
      uploadSessionId,
      file.buffer,
      dto,
    );
  }

  @Post(':uploadSessionId/issue')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Submit EIP-712 issuer signature and enqueue blockchain registration' })
  async issue(
    @Req() req: any,
    @Param('uploadSessionId') uploadSessionId: string,
    @Body() dto: IssueDocumentDto,
  ) {
    return this.documentsService.issue(req.organization.id, uploadSessionId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all documents issued by organization' })
  async listDocuments(@Req() req: any) {
    return this.documentsService.listDocuments(req.organization.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get document details and pre-signed download link' })
  async getDocument(
    @Req() req: any,
    @Param('id') documentId: string,
  ) {
    return this.documentsService.getDocument(req.organization.id, documentId);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an issued document with authorized signature' })
  async revoke(
    @Req() req: any,
    @Param('id') documentId: string,
    @Body() dto: RevokeDocumentDto,
  ) {
    return this.documentsService.revoke(req.organization.id, documentId, dto);
  }
}

