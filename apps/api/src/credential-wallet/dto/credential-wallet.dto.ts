import { IsNotEmpty, IsString, IsNumber, IsOptional, IsEmail, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClaimCredentialDto {
  @ApiProperty({ example: 'INV-8910-XKZ (Single-use claim invitation code)' })
  @IsString()
  @IsNotEmpty()
  claimInvitationCode!: string;
}

export class CreateShareDto {
  @ApiProperty({ example: 72, default: 24, description: 'Grant expiration in hours (1-720)' })
  @IsNumber()
  @Min(1)
  @Max(720)
  @IsOptional()
  expiresInHours?: number;

  @ApiProperty({ example: 'hr@companyb.com', required: false })
  @IsEmail()
  @IsOptional()
  recipientEmail?: string;
}
