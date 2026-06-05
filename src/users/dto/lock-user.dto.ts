import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';

export class LockUserDto {
  @ApiProperty({ description: 'Lý do khóa tài khoản' })
  @IsString({ message: 'Lý do khóa phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Lý do khóa không được để trống' })
  reason: string;

  @ApiPropertyOptional({
    description:
      'Thời gian khóa đến (nếu để trống hoặc null sẽ khóa vô thời hạn)',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Thời gian khóa đến phải đúng định dạng ngày giờ ISO' },
  )
  lockedUntil?: string | null;
}
