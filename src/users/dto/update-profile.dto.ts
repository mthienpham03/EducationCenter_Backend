import { IsString, IsOptional, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CertificateDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  frontImageUrl: string;

  @ApiProperty()
  @IsString()
  frontImagePublicId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  backImageUrl?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  backImagePublicId?: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  // Lecturer specific fields
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  specialization?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  experienceYears?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ required: false, type: [CertificateDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CertificateDto)
  certificates?: CertificateDto[];

  // Student specific fields
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;
}
