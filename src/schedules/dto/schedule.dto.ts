import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleStatus } from '../models/Schedule.entity';

export class CreateScheduleDto {
  @ApiProperty({ description: 'ID Khóa học', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsUUID('all', { message: 'ID Khóa học phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID Khóa học không được để trống' })
  courseId: string;

  @ApiProperty({ description: 'ID Lớp học', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsUUID('all', { message: 'ID Lớp học phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID Lớp học không được để trống' })
  classId: string;

  @ApiProperty({ description: 'ID Giảng viên', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsUUID('all', { message: 'ID Giảng viên phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID Giảng viên không được để trống' })
  lecturerId: string;

  @ApiPropertyOptional({ description: 'ID Bài giảng', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsOptional()
  @IsUUID('all', { message: 'ID Bài học phải là UUID hợp lệ' })
  lessonId?: string;

  @ApiProperty({ description: 'Thời gian bắt đầu', example: '2024-09-01T08:00:00Z' })
  @IsNotEmpty({ message: 'Thời gian bắt đầu không được để trống' })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsDateString({}, { message: 'Thời gian bắt đầu không hợp lệ' })
  startTime: string;

  @ApiProperty({ description: 'Thời gian kết thúc', example: '2024-09-01T10:00:00Z' })
  @IsNotEmpty({ message: 'Thời gian kết thúc không được để trống' })
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsDateString({}, { message: 'Thời gian kết thúc không hợp lệ' })
  endTime: string;

  @ApiPropertyOptional({ description: 'Phòng học', example: 'Phòng 101' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  room?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái lịch học',
    enum: ScheduleStatus,
    default: ScheduleStatus.SCHEDULED,
  })
  @IsOptional()
  @IsEnum(ScheduleStatus, { message: 'Trạng thái lịch học không hợp lệ' })
  status?: ScheduleStatus;
}

export class UpdateScheduleDto {
  @ApiPropertyOptional({ description: 'ID Khóa học', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsOptional()
  @IsUUID('all', { message: 'ID Khóa học phải là UUID hợp lệ' })
  courseId?: string;

  @ApiPropertyOptional({ description: 'ID Lớp học', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsOptional()
  @IsUUID('all', { message: 'ID Lớp học phải là UUID hợp lệ' })
  classId?: string;

  @ApiPropertyOptional({ description: 'ID Giảng viên', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsOptional()
  @IsUUID('all', { message: 'ID Giảng viên phải là UUID hợp lệ' })
  lecturerId?: string;

  @ApiPropertyOptional({ description: 'ID Bài giảng', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsOptional()
  @IsUUID('all', { message: 'ID Bài học phải là UUID hợp lệ' })
  lessonId?: string;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu', example: '2024-09-01T08:00:00Z' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsDateString({}, { message: 'Thời gian bắt đầu không hợp lệ' })
  startTime?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc', example: '2024-09-01T10:00:00Z' })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsDateString({}, { message: 'Thời gian kết thúc không hợp lệ' })
  endTime?: string;

  @ApiPropertyOptional({ description: 'Phòng học', example: 'Phòng 101' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  room?: string;

  @ApiPropertyOptional({ description: 'Trạng thái lịch học', enum: ScheduleStatus })
  @IsOptional()
  @IsEnum(ScheduleStatus, { message: 'Trạng thái lịch học không hợp lệ' })
  status?: ScheduleStatus;

  @ApiPropertyOptional({ description: 'Lý do (nếu hủy/dời)', example: 'Giảng viên có việc đột xuất' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({ description: 'Đánh dấu đây là cảnh báo khẩn cấp', example: true })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}
