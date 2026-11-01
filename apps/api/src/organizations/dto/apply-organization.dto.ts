import { IsEmail, IsEnum, IsNotEmpty, IsString, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrgType } from '@docauth/shared';

export class ApplyOrganizationDto {
  @ApiProperty({ example: 'Company A Technologies Pvt Ltd' })
  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @ApiProperty({ example: 'U72200KA2024PTC123456' })
  @IsString()
  @IsNotEmpty()
  registrationNumber!: string;

  @ApiProperty({ enum: OrgType, example: OrgType.CORPORATION })
  @IsEnum(OrgType)
  @IsNotEmpty()
  organizationType!: OrgType;

  @ApiProperty({ example: 'https://companya.example.com' })
  @IsUrl()
  @IsNotEmpty()
  website!: string;

  @ApiProperty({ example: 'hr-compliance@companya.example.com' })
  @IsEmail()
  @IsNotEmpty()
  contactEmail!: string;
}

export class UpdateOrganizationDto {
  @ApiProperty({ example: 'https://new-website.example.com', required: false })
  @IsUrl()
  website?: string;
}

export class AddMemberDto {
  @ApiProperty({ example: 'colleague@companya.example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'ISSUER' })
  @IsString()
  @IsNotEmpty()
  role!: string;
}

