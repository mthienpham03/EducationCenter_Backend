import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SchedulePatternDto {
  @ApiProperty({ description: 'Ngày trong tuần (0 = Chủ Nhật, 1 = Thứ 2, ..., 6 = Thứ 7)', example: 1 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Thời gian bắt đầu (vd: 08:00)', example: '08:00' })
  @IsString()
  startTime: string;

  @ApiProperty({ description: 'Thời gian kết thúc (vd: 10:00)', example: '10:00' })
  @IsString()
  endTime: string;

  @ApiProperty({ description: 'Phòng học (nếu có)', required: false, example: 'Phòng 101' })
  @IsString()
  @IsOptional()
  room?: string;
}

export class AutoGenerateScheduleDto {
  @ApiProperty({ description: 'ID của khóa học', example: 'uuid-course-123' })
  @IsUUID()
  courseId: string;

  @ApiProperty({ description: 'ID của lớp học', example: 'uuid-class-123' })
  @IsUUID()
  classId: string;

  @ApiProperty({ description: 'ID của giảng viên phụ trách', example: 'uuid-lecturer-123' })
  @IsUUID()
  lecturerId: string;

  @ApiProperty({ description: 'Ngày bắt đầu dự kiến (YYYY-MM-DD)', example: '2026-08-05' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ 
    description: 'Quy luật sinh lịch theo ngày trong tuần', 
    type: [SchedulePatternDto] 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchedulePatternDto)
  schedulePattern: SchedulePatternDto[];
}
