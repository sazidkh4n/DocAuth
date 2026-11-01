import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUploadSessionDto {
  @ApiProperty({ example: 'EXPERIENCE_LETTER' })
  @IsString()
  @IsNotEmpty()
  documentTypeCode!: string;

  @ApiProperty({ example: 'rahul.sharma@example.com' })
  @IsEmail()
  @IsNotEmpty()
  holderEmail!: string;

  @ApiProperty({ example: 'EMP-2024-8891' })
  @IsString()
  @IsNotEmpty()
  holderSubjectReference!: string;

  @ApiProperty({ example: '2028-12-31T23:59:59.000Z', required: false })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}

export class IssueDocumentDto {
  @ApiProperty({ example: '0x28f102... (hex-encoded EIP-712 signature)' })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}

export class RevokeDocumentDto {
  @ApiProperty({ example: 'Credential revoked due to falsified employment history.' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ example: '0x8a92... (hex-encoded EIP-712 revocation signature)' })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}

export class CreateShareDto {
  @ApiProperty({ example: 72, description: 'Lifespan in hours' })
  @IsNumber()
  @Min(1)
  @Max(720) // Max 30 days
  expiresInHours!: number;

  @ApiProperty({ example: 'hr@companyb.com', required: false })
  @IsEmail()
  @IsOptional()
  recipientEmail?: string;
}

