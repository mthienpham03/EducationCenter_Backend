import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLecturerDto {
  @ApiProperty({ description: 'Email đăng nhập của giảng viên' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ description: 'Họ và tên giảng viên' })
  @IsString()
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional({ description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ description: 'Chuyên ngành giảng dạy' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  specialization?: string;

  @ApiPropertyOptional({ description: 'Số năm kinh nghiệm' })
  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @ApiPropertyOptional({ description: 'Ảnh đại diện của giảng viên' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class CreateStudentDto {
  @ApiProperty({ description: 'Email đăng nhập của học viên' })
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({ description: 'Họ và tên học viên' })
  @IsString()
  @IsNotEmpty({ message: 'Họ và tên không được để trống' })
  @MaxLength(255)
  fullName: string;

  @ApiPropertyOptional({ description: 'Số điện thoại' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty({ description: 'Mã học viên (duy nhất)' })
  @IsString()
  @IsNotEmpty({ message: 'Mã học viên không được để trống' })
  @MaxLength(100)
  studentCode: string;

  @ApiPropertyOptional({ description: 'Ngày sinh (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh phải đúng định dạng YYYY-MM-DD' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ' })
  @IsOptional()
  @IsString()
  address?: string;
}
