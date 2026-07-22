import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  ValidateNested,
  ArrayMinSize,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionStatus, QuestionApprovalStatus } from '../models/QuestionBank.entity';

export enum QuestionTypeEnum {
  MCQ_SINGLE = 'MCQ_SINGLE',
  MCQ_MULTIPLE = 'MCQ_MULTIPLE',
  TRUE_FALSE = 'TRUE_FALSE',
}

export class ReviewQuestionDto {
  @ApiProperty({ description: 'Trạng thái kiểm duyệt', enum: QuestionApprovalStatus, example: QuestionApprovalStatus.APPROVED })
  @IsEnum(QuestionApprovalStatus, { message: 'Trạng thái duyệt không hợp lệ' })
  status: QuestionApprovalStatus;

  @ApiPropertyOptional({ description: 'Lý do từ chối (bắt buộc nếu từ chối)', example: 'Nội dung câu hỏi chưa chính xác' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class CreateQuestionOptionDto {
  @ApiProperty({ description: 'Nội dung đáp án', example: 'Đúng' })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung đáp án không được để trống' })
  content: string;

  @ApiProperty({ description: 'Đánh dấu đáp án đúng/sai', example: true })
  @IsBoolean()
  isCorrect: boolean;

  @ApiPropertyOptional({ description: 'Thứ tự hiển thị', example: 1 })
  @IsOptional()
  @IsNumber()
  orderIndex?: number;
}

export class CreateQuestionDto {
  @ApiPropertyOptional({ description: 'ID khóa học (nếu câu hỏi dùng chung cho khóa)' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: 'ID bài học (nếu câu hỏi thuộc bài học cụ thể)' })
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiProperty({ description: 'Loại câu hỏi', enum: QuestionTypeEnum })
  @IsEnum(QuestionTypeEnum, { message: 'Loại câu hỏi không hợp lệ' })
  questionType: QuestionTypeEnum;

  @ApiProperty({ description: 'Nội dung câu hỏi', example: '1 + 1 bằng mấy?' })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung câu hỏi không được để trống' })
  content: string;

  @ApiPropertyOptional({ description: 'Độ khó', example: 'Dễ' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Trạng thái', enum: QuestionStatus })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional({ description: 'Trạng thái duyệt (Admin truyền hoặc mặc định)', enum: QuestionApprovalStatus })
  @IsOptional()
  @IsEnum(QuestionApprovalStatus)
  approvalStatus?: QuestionApprovalStatus;

  @ApiProperty({ type: [CreateQuestionOptionDto], description: 'Danh sách đáp án' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  @ArrayMinSize(2, { message: 'Câu hỏi phải có ít nhất 2 đáp án' })
  options: CreateQuestionOptionDto[];
}

export class UpdateQuestionDto {
  @ApiPropertyOptional({ description: 'Loại câu hỏi', enum: QuestionTypeEnum })
  @IsOptional()
  @IsEnum(QuestionTypeEnum)
  questionType?: QuestionTypeEnum;

  @ApiPropertyOptional({ description: 'Nội dung câu hỏi' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Độ khó' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Trạng thái', enum: QuestionStatus })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional({ description: 'Trạng thái duyệt', enum: QuestionApprovalStatus })
  @IsOptional()
  @IsEnum(QuestionApprovalStatus)
  approvalStatus?: QuestionApprovalStatus;

  @ApiPropertyOptional({ type: [CreateQuestionOptionDto], description: 'Ghi đè lại toàn bộ đáp án' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  @ArrayMinSize(2)
  options?: CreateQuestionOptionDto[];
}
