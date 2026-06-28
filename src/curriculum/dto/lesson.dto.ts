import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayMinSize,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LessonStatus } from '../models/Lesson.entity';

export class CreateLessonDto {
  @ApiProperty({ description: 'Tiêu đề bài học', example: 'Bài 1: Từ vựng cơ bản' })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề bài học không được để trống' })
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Tóm tắt nội dung bài học', example: 'Bài học giới thiệu 50 từ vựng cơ bản nhất' })
  @IsOptional()
  @IsString()
  contentSummary?: string;

  @ApiPropertyOptional({ description: 'Trạng thái bài học', enum: LessonStatus, default: LessonStatus.DRAFT })
  @IsOptional()
  @IsEnum(LessonStatus, { message: 'Trạng thái bài học không hợp lệ (draft / published)' })
  status?: LessonStatus;
}

export class UpdateLessonDto {
  @ApiPropertyOptional({ description: 'Tiêu đề bài học', example: 'Bài 1: Từ vựng cơ bản (Cập nhật)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt nội dung bài học', example: 'Nội dung cập nhật' })
  @IsOptional()
  @IsString()
  contentSummary?: string;

  @ApiPropertyOptional({ description: 'Trạng thái bài học', enum: LessonStatus })
  @IsOptional()
  @IsEnum(LessonStatus, { message: 'Trạng thái bài học không hợp lệ (draft / published)' })
  status?: LessonStatus;
}

export class ReorderLessonsDto {
  @ApiProperty({
    description: 'Danh sách ID các bài học theo thứ tự mới',
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    type: [String],
  })
  @IsArray({ message: 'orderedIds phải là một mảng' })
  @ArrayMinSize(1, { message: 'Danh sách ID không được rỗng' })
  @IsUUID('4', { each: true, message: 'Mỗi ID phải là UUID hợp lệ' })
  orderedIds: string[];
}
