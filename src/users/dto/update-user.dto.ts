import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
  IsInt,
  Min,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLecturerDto {
  @ApiPropertyOptional({ description: 'Email mới của giảng viên' })
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @ApiPropertyOptional({ description: 'Họ và tên giảng viên' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Danh sách ID chuyên ngành giảng dạy', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specializationIds?: string[];

  @ApiPropertyOptional({ description: 'Số năm kinh nghiệm' })
  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;
}

export class UpdateStudentDto {
  @ApiPropertyOptional({ description: 'Email mới của học viên' })
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  email?: string;

  @ApiPropertyOptional({ description: 'Họ và tên học viên' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Mã học viên (duy nhất)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  studentCode?: string;

  @ApiPropertyOptional({ description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh phải đúng định dạng YYYY-MM-DD' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ' })
  @IsOptional()
  @IsString()
  address?: string;
}
