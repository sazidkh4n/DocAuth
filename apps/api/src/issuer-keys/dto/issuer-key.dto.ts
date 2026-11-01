import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterSigningKeyDto {
  @ApiProperty({ example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum public address' })
  @IsNotEmpty()
  walletAddress!: string;
}

export class RotateSigningKeyDto {
  @ApiProperty({ example: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' })
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum public address' })
  @IsNotEmpty()
  newWalletAddress!: string;
}

export class RevokeSigningKeyDto {
  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isCompromised?: boolean;

  @ApiProperty({ example: '2026-10-25T12:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  compromisedAt?: string;

  @ApiProperty({ example: 'Signing server decommissioned.' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

