import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '../models/Document.entity';

export class UpdateDocumentDto {
  @ApiPropertyOptional({
    description: 'Tiêu đề tài liệu',
    example: 'Slide bài học số 1 (Đã chỉnh sửa)',
  })
  @IsOptional()
  @IsString({ message: 'Tiêu đề tài liệu phải là chuỗi ký tự' })
  @MaxLength(255, { message: 'Tiêu đề tài liệu không vượt quá 255 ký tự' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Chế độ hiển thị (public / restricted)',
    example: 'public',
  })
  @IsOptional()
  @IsString({ message: 'Chế độ hiển thị phải là chuỗi ký tự' })
  visibility?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái tài liệu',
    enum: DocumentStatus,
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
