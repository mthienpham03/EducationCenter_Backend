import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateLecturerDto, CreateStudentDto } from '../dto/create-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../models/User.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // Chỉ Admin mới được truy cập các API trong controller này
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('lecturers')
  @ApiOperation({ summary: 'Admin tạo tài khoản Giảng viên mới' })
  @ApiResponse({ status: 201, description: 'Tạo tài khoản Giảng viên thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc Email đã tồn tại' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async createLecturer(@Body() createLecturerDto: CreateLecturerDto) {
    return this.usersService.createLecturer(createLecturerDto);
  }

  @Post('students')
  @ApiOperation({ summary: 'Admin tạo tài khoản Học viên mới' })
  @ApiResponse({ status: 201, description: 'Tạo tài khoản Học viên thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ, Email hoặc Mã học viên đã tồn tại' })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async createStudent(@Body() createStudentDto: CreateStudentDto) {
    return this.usersService.createStudent(createStudentDto);
  }
}
