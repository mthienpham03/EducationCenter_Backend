import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsInt,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  IsArray,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuizStatus } from '../models/Quiz.entity';

// ==================== QUIZ CRUD ====================

export class CreateQuizDto {
  @ApiProperty({ description: 'ID khóa học liên kết', example: 'uuid-of-course' })
  @IsUUID('4', { message: 'courseId phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'courseId không được để trống' })
  courseId: string;

  @ApiPropertyOptional({ description: 'ID bài học liên kết (nếu quiz thuộc về một bài học cụ thể)', example: 'uuid-of-lesson' })
  @IsOptional()
  @IsUUID('4', { message: 'lessonId phải là UUID hợp lệ' })
  lessonId?: string;

  @ApiProperty({ description: 'Tiêu đề quiz', example: 'Bài kiểm tra Chương 1' })
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề quiz không được để trống' })
  @MaxLength(255, { message: 'Tiêu đề quiz tối đa 255 ký tự' })
  title: string;

  @ApiPropertyOptional({
    description: 'Thời gian làm bài (phút). Null = không giới hạn thời gian',
    example: 45,
    minimum: 1,
    maximum: 600,
  })
  @IsOptional()
  @IsInt({ message: 'Thời gian phải là số nguyên' })
  @Min(1, { message: 'Thời gian tối thiểu là 1 phút' })
  @Max(600, { message: 'Thời gian tối đa là 600 phút' })
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Số lần làm bài tối đa. Mặc định là 1',
    example: 3,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'Số lần làm bài phải là số nguyên' })
  @Min(1, { message: 'Số lần làm bài tối thiểu là 1' })
  @Max(100, { message: 'Số lần làm bài tối đa là 100' })
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: 'Bật/tắt xáo trộn câu hỏi ngẫu nhiên. Mặc định là false',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'shuffleQuestions phải là boolean' })
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({
    description: 'Trạng thái ban đầu của quiz',
    enum: QuizStatus,
    default: QuizStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(QuizStatus, { message: 'Trạng thái quiz không hợp lệ' })
  status?: QuizStatus;
}

export class UpdateQuizDto {
  @ApiPropertyOptional({ description: 'Tiêu đề quiz', example: 'Bài kiểm tra Chương 1 (cập nhật)' })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Tiêu đề quiz tối đa 255 ký tự' })
  title?: string;

  @ApiPropertyOptional({
    description: 'ID bài học liên kết. Truyền null để bỏ liên kết bài học',
    example: 'uuid-of-lesson',
  })
  @IsOptional()
  @IsUUID('4', { message: 'lessonId phải là UUID hợp lệ' })
  lessonId?: string | null;

  @ApiPropertyOptional({
    description: 'Thời gian làm bài (phút). Truyền null để bỏ giới hạn thời gian',
    example: 60,
    minimum: 1,
    maximum: 600,
  })
  @IsOptional()
  @IsInt({ message: 'Thời gian phải là số nguyên' })
  @Min(1, { message: 'Thời gian tối thiểu là 1 phút' })
  @Max(600, { message: 'Thời gian tối đa là 600 phút' })
  durationMinutes?: number | null;

  @ApiPropertyOptional({
    description: 'Số lần làm bài tối đa',
    example: 5,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt({ message: 'Số lần làm bài phải là số nguyên' })
  @Min(1, { message: 'Số lần làm bài tối thiểu là 1' })
  @Max(100, { message: 'Số lần làm bài tối đa là 100' })
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: 'Bật/tắt xáo trộn câu hỏi ngẫu nhiên',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'shuffleQuestions phải là boolean' })
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({
    description: 'Trạng thái quiz',
    enum: QuizStatus,
  })
  @IsOptional()
  @IsEnum(QuizStatus, { message: 'Trạng thái quiz không hợp lệ' })
  status?: QuizStatus;
}

export class UpdateQuizStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới của quiz',
    enum: QuizStatus,
    example: QuizStatus.OPEN,
  })
  @IsEnum(QuizStatus, { message: 'Trạng thái quiz không hợp lệ' })
  @IsNotEmpty()
  status: QuizStatus;
}

// ==================== QUIZ QUESTIONS ====================

export class AddQuizQuestionDto {
  @ApiProperty({ description: 'ID câu hỏi từ ngân hàng câu hỏi', example: 'uuid-of-question' })
  @IsUUID('4', { message: 'questionId phải là UUID hợp lệ' })
  @IsNotEmpty()
  questionId: string;

  @ApiPropertyOptional({
    description: 'Điểm số cho câu hỏi này. Mặc định là 1',
    example: 2.5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Điểm phải là số' })
  @Min(0, { message: 'Điểm không được âm' })
  score?: number;

  @ApiPropertyOptional({
    description: 'Thứ tự hiển thị câu hỏi',
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: 'orderIndex phải là số nguyên' })
  @Min(0)
  orderIndex?: number;
}

export class AddMultipleQuestionsDto {
  @ApiProperty({
    description: 'Danh sách câu hỏi cần thêm vào quiz',
    type: [AddQuizQuestionDto],
  })
  @IsArray({ message: 'questions phải là mảng' })
  questions: AddQuizQuestionDto[];
}
