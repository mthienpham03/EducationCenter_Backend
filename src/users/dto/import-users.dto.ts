import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../models/User.entity';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class ImportUsersDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'File Excel danh sách tài khoản' })
  @IsNotEmpty({ message: 'File không được để trống' })
  file: any; // Multer sẽ xử lý file

  @ApiProperty({ description: 'Vai trò người dùng (Lưu ý: Chỉ import LECTURER hoặc STUDENT)', enum: UserRole })
  @IsEnum(UserRole, { message: 'Vai trò không hợp lệ' })
  role: UserRole;
}
