import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '../models/Document.entity';

export enum DocumentType {
  PDF = 'pdf',
  DOC = 'doc',
  VIDEO = 'video',
  IMAGE = 'image',
  SLIDE = 'slide',
  OTHER = 'other',
}

export enum DocumentVisibility {
  PUBLIC = 'public',
  ENROLLED_ONLY = 'enrolled_only',
}

export class UploadDocumentDto {
  @ApiProperty({ description: 'ID bài học gắn tài liệu', example: 'uuid-lesson' })
  @IsUUID('4', { message: 'lessonId phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID bài học không được để trống' })
  lessonId: string;

  @ApiProperty({ description: 'Tiêu đề tài liệu', example: 'Slide bài giảng Chương 1' })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề tài liệu không được để trống' })
  @MaxLength(255)
  title: string;

  @ApiProperty({
    description: 'Loại tài liệu',
    enum: DocumentType,
    example: DocumentType.PDF,
  })
  @IsEnum(DocumentType, { message: 'Loại tài liệu không hợp lệ (pdf/doc/video/image/slide/other)' })
  @IsNotEmpty()
  type: DocumentType;

  @ApiPropertyOptional({
    description: 'Quyền xem tài liệu',
    enum: DocumentVisibility,
    default: DocumentVisibility.ENROLLED_ONLY,
  })
  @IsOptional()
  @IsEnum(DocumentVisibility, { message: 'Giá trị visibility không hợp lệ (public/enrolled_only)' })
  visibility?: DocumentVisibility;

  @ApiPropertyOptional({
    description: 'Trạng thái tài liệu',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(DocumentStatus, { message: 'Trạng thái tài liệu không hợp lệ' })
  status?: DocumentStatus;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional({ description: 'Tiêu đề tài liệu', example: 'Slide bài giảng (Cập nhật)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'Quyền xem tài liệu',
    enum: DocumentVisibility,
  })
  @IsOptional()
  @IsEnum(DocumentVisibility, { message: 'Giá trị visibility không hợp lệ' })
  visibility?: DocumentVisibility;

  @ApiPropertyOptional({
    description: 'Trạng thái tài liệu',
    enum: DocumentStatus,
  })
  @IsOptional()
  @IsEnum(DocumentStatus, { message: 'Trạng thái tài liệu không hợp lệ' })
  status?: DocumentStatus;
}

export class UploadVersionDto {
  @ApiPropertyOptional({
    description: 'Ghi chú thay đổi của phiên bản mới',
    example: 'Cập nhật nội dung slide 5-10, thêm bài tập thực hành',
  })
  @IsOptional()
  @IsString()
  changeNote?: string;
}
