import { IsNotEmpty, IsString, MaxLength, IsOptional, IsEnum, IsInt, Min, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '../models/Class.entity';

export class CreateClassDto {
  @ApiProperty({ description: 'Tên lớp học', example: 'Lớp IELTS-01' })
  @IsString()
  @IsNotEmpty({ message: 'Tên lớp học không được để trống' })
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Sĩ số học viên tối đa', example: 25 })
  @IsOptional()
  @IsInt({ message: 'Sĩ số học viên tối đa phải là số nguyên' })
  @Min(1, { message: 'Sĩ số học viên tối đa phải ít nhất là 1' })
  maxStudents?: number;

  @ApiPropertyOptional({ description: 'Trạng thái lớp học', enum: ClassStatus, default: ClassStatus.DRAFT })
  @IsOptional()
  @IsEnum(ClassStatus, { message: 'Trạng thái lớp học không hợp lệ' })
  status?: ClassStatus;
}

export class UpdateClassDto {
  @ApiPropertyOptional({ description: 'Tên lớp học', example: 'Lớp IELTS-01' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Sĩ số học viên tối đa', example: 25 })
  @IsOptional()
  @IsInt({ message: 'Sĩ số học viên tối đa phải là số nguyên' })
  @Min(1, { message: 'Sĩ số học viên tối đa phải ít nhất là 1' })
  maxStudents?: number;

  @ApiPropertyOptional({ description: 'Trạng thái lớp học', enum: ClassStatus })
  @IsOptional()
  @IsEnum(ClassStatus, { message: 'Trạng thái lớp học không hợp lệ' })
  status?: ClassStatus;
}

export class AssignLecturerDto {
  @ApiProperty({ description: 'ID Giảng viên (UUID)', example: 'f3914e6f-4311-477a-9db2-f725a3a290a1' })
  @IsUUID('all', { message: 'ID Giảng viên phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID Giảng viên không được để trống' })
  lecturerId: string;

  @ApiProperty({ description: 'Vai trò của giảng viên trong lớp (ví dụ: homeroom, lecturer)', example: 'homeroom' })
  @IsString()
  @IsNotEmpty({ message: 'Vai trò không được để trống' })
  role: string;
}

export class EnrollStudentDto {
  @ApiProperty({ description: 'ID Học viên (UUID)', example: 'a06df53a-c603-4f9e-a89e-cf7bb523a7bb' })
  @IsUUID('all', { message: 'ID Học viên phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID Học viên không được để trống' })
  studentId: string;
}

export class TransferStudentDto {
  @ApiProperty({ description: 'ID Học viên (UUID)', example: 'a06df53a-c603-4f9e-a89e-cf7bb523a7bb' })
  @IsUUID('all', { message: 'ID Học viên phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID Học viên không được để trống' })
  studentId: string;

  @ApiProperty({ description: 'ID Lớp học hiện tại (UUID)', example: 'b07df53a-c603-4f9e-a89e-cf7bb523a7bb' })
  @IsUUID('all', { message: 'ID Lớp học nguồn phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID Lớp học nguồn không được để trống' })
  fromClassId: string;

  @ApiProperty({ description: 'ID Lớp học mới muốn chuyển tới (UUID)', example: 'c08df53a-c603-4f9e-a89e-cf7bb523a7bb' })
  @IsUUID('all', { message: 'ID Lớp học đích phải là UUID hợp lệ' })
  @IsNotEmpty({ message: 'ID Lớp học đích không được để trống' })
  toClassId: string;

  @ApiPropertyOptional({ description: 'Lý do chuyển lớp', example: 'Trùng lịch làm việc cá nhân' })
  @IsOptional()
  @IsString()
  reason?: string;
}
