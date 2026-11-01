import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewDecisionDto {
  @ApiProperty({ example: 'Verified corporate incorporation records and tax filing.' })
  @IsString()
  @IsNotEmpty()
  reviewerNotes!: string;
}

export class SuspendOrganizationDto {
  @ApiProperty({ example: 'Compliance breach under investigation.' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

