import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsArray,
  ArrayMinSize,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChapterDto {
  @ApiProperty({ description: 'Tiêu đề chương học', example: 'Chương 1: Giới thiệu' })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề chương học không được để trống' })
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết chương học', example: 'Chương này giới thiệu các khái niệm cơ bản' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateChapterDto {
  @ApiPropertyOptional({ description: 'Tiêu đề chương học', example: 'Chương 1: Giới thiệu (Cập nhật)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết chương học', example: 'Mô tả cập nhật' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ReorderChaptersDto {
  @ApiProperty({
    description: 'Danh sách ID các chương theo thứ tự mới',
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    type: [String],
  })
  @IsArray({ message: 'orderedIds phải là một mảng' })
  @ArrayMinSize(1, { message: 'Danh sách ID không được rỗng' })
  @IsUUID('4', { each: true, message: 'Mỗi ID phải là UUID hợp lệ' })
  orderedIds: string[];
}
