import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateLecturerDto, CreateStudentDto } from '../dto/create-user.dto';
import { LockUserDto } from '../dto/lock-user.dto';
import { UpdateLecturerDto, UpdateStudentDto } from '../dto/update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, UserStatus } from '../models/User.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN) // Chỉ Admin mới được truy cập các API trong controller này
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Admin lấy danh sách tất cả người dùng' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm kiếm theo tên, email hoặc SĐT',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: UserRole,
    description: 'Lọc theo vai trò',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: UserStatus,
    description: 'Lọc theo trạng thái',
  })
  async findAll(
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
  ) {
    return this.usersService.findAll(search, role, status);
  }

  @Post('lecturers')
  @ApiOperation({ summary: 'Admin tạo tài khoản Giảng viên mới' })
  @ApiResponse({
    status: 201,
    description: 'Tạo tài khoản Giảng viên thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc Email đã tồn tại',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async createLecturer(@Body() createLecturerDto: CreateLecturerDto) {
    return this.usersService.createLecturer(createLecturerDto);
  }

  @Post('students')
  @ApiOperation({ summary: 'Admin tạo tài khoản Học viên mới' })
  @ApiResponse({
    status: 201,
    description: 'Tạo tài khoản Học viên thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ, Email hoặc Mã học viên đã tồn tại',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async createStudent(@Body() createStudentDto: CreateStudentDto) {
    return this.usersService.createStudent(createStudentDto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Admin cập nhật trạng thái hoạt động của tài khoản',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
  ) {
    return this.usersService.updateStatus(id, status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin xóa tài khoản người dùng' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Get('lecturers')
  @ApiOperation({ summary: 'Admin lấy danh sách tất cả Giảng viên' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm kiếm theo tên, email, SĐT hoặc chuyên ngành',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: UserStatus,
    description: 'Lọc theo trạng thái',
  })
  async findLecturers(
    @Query('search') search?: string,
    @Query('status') status?: UserStatus,
  ) {
    return this.usersService.findLecturers(search, status);
  }

  @Get('students')
  @ApiOperation({ summary: 'Admin lấy danh sách tất cả Học viên' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm kiếm theo tên, email, SĐT, mã học viên hoặc địa chỉ',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: UserStatus,
    description: 'Lọc theo trạng thái',
  })
  async findStudents(
    @Query('search') search?: string,
    @Query('status') status?: UserStatus,
  ) {
    return this.usersService.findStudents(search, status);
  }

  @Post(':id/lock')
  @ApiOperation({
    summary: 'Admin khóa tài khoản người dùng có thời hạn hoặc vô thời hạn',
  })
  @ApiResponse({
    status: 200,
    description: 'Khóa tài khoản thành công và gửi email thông báo',
  })
  async lockUser(@Param('id') id: string, @Body() lockUserDto: LockUserDto) {
    return this.usersService.lockUser(id, lockUserDto);
  }

  @Post(':id/unlock')
  @ApiOperation({ summary: 'Admin mở khóa tài khoản người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Mở khóa tài khoản thành công và gửi email thông báo',
  })
  async unlockUser(@Param('id') id: string) {
    return this.usersService.unlockUser(id);
  }

  @Patch('lecturers/:id')
  @ApiOperation({ summary: 'Admin cập nhật thông tin Giảng viên' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật tài khoản Giảng viên thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc Email đã tồn tại',
  })
  async updateLecturer(
    @Param('id') id: string,
    @Body() updateLecturerDto: UpdateLecturerDto,
  ) {
    return this.usersService.updateLecturer(id, updateLecturerDto);
  }

  @Patch('students/:id')
  @ApiOperation({ summary: 'Admin cập nhật thông tin Học viên' })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật tài khoản Học viên thành công',
  })
  @ApiResponse({
    status: 400,
    description: 'Dữ liệu không hợp lệ hoặc Email/Mã học viên đã tồn tại',
  })
  async updateStudent(
    @Param('id') id: string,
    @Body() updateStudentDto: UpdateStudentDto,
  ) {
    return this.usersService.updateStudent(id, updateStudentDto);
  }
}
