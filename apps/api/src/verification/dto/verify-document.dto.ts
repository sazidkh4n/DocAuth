import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDocumentDto {
  @ApiProperty({
    example: '0x4a7e9123... (optional 32-byte hex credential ID or scanned from QR)',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'credentialId must be a 0x-prefixed 32-byte hex string (66 characters total)',
  })
  credentialId?: string;
}

