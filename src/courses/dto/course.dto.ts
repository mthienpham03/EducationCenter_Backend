import { IsNotEmpty, IsString, MaxLength, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourseStatus } from '../models/Course.entity';

export class CreateCourseDto {
  @ApiProperty({ description: 'Mã khóa học (duy nhất)', example: 'IELTS-INT-6.5' })
  @IsString()
  @IsNotEmpty({ message: 'Mã khóa học không được để trống' })
  @MaxLength(100)
  code: string;

  @ApiProperty({ description: 'Tên khóa học', example: 'IELTS 6.5 Intensive' })
  @IsString()
  @IsNotEmpty({ message: 'Tên khóa học không được để trống' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết khóa học', example: 'Khóa học IELTS chuyên sâu 4 kỹ năng mục tiêu 6.5+' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Đường dẫn ảnh đại diện khóa học', example: 'https://cloudinary.com/image.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Trình độ/Cấp độ khóa học', example: 'Intermediate' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  level?: string;

  @ApiPropertyOptional({ description: 'Trạng thái khóa học', enum: CourseStatus, default: CourseStatus.DRAFT })
  @IsOptional()
  @IsEnum(CourseStatus, { message: 'Trạng thái khóa học không hợp lệ' })
  status?: CourseStatus;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu khóa học', example: '2026-06-15' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc khóa học', example: '2026-09-15' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  endDate?: string;
}

export class UpdateCourseDto {
  @ApiPropertyOptional({ description: 'Mã khóa học (duy nhất)', example: 'IELTS-INT-6.5' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ description: 'Tên khóa học', example: 'IELTS 6.5 Intensive' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết khóa học', example: 'Khóa học IELTS chuyên sâu' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Đường dẫn ảnh đại diện', example: 'https://cloudinary.com/image.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'Trình độ/Cấp độ khóa học', example: 'Intermediate' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  level?: string;

  @ApiPropertyOptional({ description: 'Trạng thái khóa học', enum: CourseStatus })
  @IsOptional()
  @IsEnum(CourseStatus, { message: 'Trạng thái khóa học không hợp lệ' })
  status?: CourseStatus;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu khóa học', example: '2026-06-15' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày bắt đầu không hợp lệ' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc khóa học', example: '2026-09-15' })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày kết thúc không hợp lệ' })
  endDate?: string;
}
