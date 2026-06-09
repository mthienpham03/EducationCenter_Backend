import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSpecializationDto {
  @ApiProperty({ description: 'Tên chuyên ngành' })
  @IsString()
  @IsNotEmpty({ message: 'Tên chuyên ngành không được để trống' })
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Mã chuyên ngành (viết tắt)' })
  @IsString()
  @IsNotEmpty({ message: 'Mã chuyên ngành không được để trống' })
  @MaxLength(100)
  code: string;

  @ApiPropertyOptional({ description: 'Mô tả chuyên ngành' })
  @IsOptional()
  @IsString()
  description?: string;
}
