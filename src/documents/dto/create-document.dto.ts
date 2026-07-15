import {
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
  IsEnum,
  IsArray,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '../models/Document.entity';

export class CreateDocumentDto {
  @ApiPropertyOptional({
    description: 'ID của bài học liên kết',
    example: 'a2bbcc95-5483-4976-b3aa-381e658fbeb8',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID bài học không đúng định dạng UUID' })
  lessonId?: string;

  @ApiPropertyOptional({
    description: 'Tiêu đề tài liệu (nếu trống sẽ tự động lấy tên file gốc)',
    example: 'Slide bài học số 1',
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề tài liệu phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Tiêu đề tài liệu không vượt quá 255 ký tự' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Chế độ hiển thị (public / restricted)',
    default: 'restricted',
    example: 'restricted',
  })
  @IsOptional()
  @IsString({ message: 'Chế độ hiển thị phải là chuỗi ký tự' })
  visibility?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái tài liệu',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(DocumentStatus, { message: 'Trạng thái tài liệu không hợp lệ' })
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Danh sách ID sinh viên được phép xem tài liệu (nếu visibility = restricted)',
    type: [String],
  })
  @IsOptional()
  assignedStudentIds?: string[];
}
