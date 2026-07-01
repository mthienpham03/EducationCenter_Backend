import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AddVersionDto {
  @ApiPropertyOptional({
    description: 'Mô tả ngắn gọn về các thay đổi trong phiên bản mới',
    example: 'Cập nhật thêm chương 1.2',
  })
  @IsOptional()
  @IsString({ message: 'Mô tả thay đổi phải là chuỗi ký tự' })
  changeNote?: string;
}
