import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/models/User.entity';
import { CoursesService } from '../services/courses.service';
import { CreateCourseDto, UpdateCourseDto } from '../dto/course.dto';
import { CreateClassDto, UpdateClassDto, AssignLecturerDto, EnrollStudentDto, TransferStudentDto } from '../dto/class.dto';

@ApiTags('Courses & Classes Management')
@ApiBearerAuth()
@Controller('api/v1/courses')
@UseGuards(JwtAuthGuard)
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // ==================== COURSE CRUD ====================

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin tạo mới một khóa học' })
  @ApiResponse({ status: 201, description: 'Tạo khóa học thành công' })
  async createCourse(@Req() req, @Body() dto: CreateCourseDto) {
    return this.coursesService.createCourse(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách khóa học (Có tìm kiếm & lọc trạng thái)' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm theo tên hoặc mã khóa học' })
  @ApiQuery({ name: 'status', required: false, description: 'Trạng thái khóa học (draft / published / archived)' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách khóa học thành công' })
  async findAllCourses(@Query('search') search?: string, @Query('status') status?: string) {
    return this.coursesService.findAllCourses(search, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết thông tin một khóa học' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết thành công' })
  async findCourseById(@Param('id') id: string) {
    return this.coursesService.findCourseById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin cập nhật thông tin khóa học' })
  @ApiResponse({ status: 200, description: 'Cập nhật khóa học thành công' })
  async updateCourse(@Req() req, @Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.updateCourse(id, dto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin xóa (soft-delete) khóa học' })
  @ApiResponse({ status: 200, description: 'Xóa khóa học thành công' })
  async removeCourse(@Param('id') id: string) {
    return this.coursesService.removeCourse(id);
  }

  // ==================== CLASS CRUD ====================

  @Post(':courseId/classes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin tạo mới một lớp học trong khóa học' })
  @ApiResponse({ status: 201, description: 'Tạo lớp học thành công' })
  async createClass(
    @Req() req,
    @Param('courseId') courseId: string,
    @Body() dto: CreateClassDto,
  ) {
    return this.coursesService.createClass(courseId, dto, req.user.id);
  }

  @Get(':courseId/classes')
  @ApiOperation({ summary: 'Lấy danh sách lớp học thuộc khóa học' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách lớp học thành công' })
  async findClassesByCourse(@Param('courseId') courseId: string) {
    return this.coursesService.findClassesByCourse(courseId);
  }

  // ==================== CLASS TRANSFER & HISTORY ====================

  @Post('classes/transfer')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin thực hiện điều chuyển lớp cho học viên trong cùng một khóa học' })
  @ApiResponse({ status: 201, description: 'Điều chuyển lớp thành công' })
  async transferStudent(@Req() req, @Body() dto: TransferStudentDto) {
    return this.coursesService.transferStudent(dto, req.user.id);
  }

  @Get('classes/transfer-histories')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin xem danh sách lịch sử biến động/điều chuyển lớp của học viên' })
  @ApiQuery({ name: 'studentId', required: false, description: 'Lọc theo ID học viên' })
  @ApiQuery({ name: 'courseId', required: false, description: 'Lọc theo ID khóa học' })
  @ApiQuery({ name: 'fromClassId', required: false, description: 'Lọc theo ID lớp cũ' })
  @ApiQuery({ name: 'toClassId', required: false, description: 'Lọc theo ID lớp mới' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách lịch sử thành công' })
  async findTransferHistories(
    @Query('studentId') studentId?: string,
    @Query('courseId') courseId?: string,
    @Query('fromClassId') fromClassId?: string,
    @Query('toClassId') toClassId?: string,
  ) {
    return this.coursesService.findTransferHistories({ studentId, courseId, fromClassId, toClassId });
  }

  @Get('classes/:id')
  @ApiOperation({ summary: 'Lấy chi tiết lớp học' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết lớp học thành công' })
  async findClassById(@Param('id') id: string) {
    return this.coursesService.findClassById(id);
  }

  @Patch('classes/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin cập nhật thông tin lớp học' })
  @ApiResponse({ status: 200, description: 'Cập nhật lớp học thành công' })
  async updateClass(@Req() req, @Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.coursesService.updateClass(id, dto, req.user.id);
  }

  @Delete('classes/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin xóa (soft-delete) lớp học' })
  @ApiResponse({ status: 200, description: 'Xóa lớp học thành công' })
  async removeClass(@Param('id') id: string) {
    return this.coursesService.removeClass(id);
  }

  // ==================== LECTURER ASSIGNMENT ====================

  @Post('classes/:classId/lecturers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin phân công giảng viên vào lớp (chủ nhiệm hoặc giảng dạy)' })
  @ApiResponse({ status: 201, description: 'Phân công giảng viên thành công' })
  async assignLecturer(@Param('classId') classId: string, @Body() dto: AssignLecturerDto) {
    return this.coursesService.assignLecturer(classId, dto);
  }

  @Delete('classes/:classId/lecturers/:lecturerId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin hủy phân công giảng viên khỏi lớp học' })
  @ApiResponse({ status: 200, description: 'Hủy phân công giảng viên thành công' })
  async removeLecturer(@Param('classId') classId: string, @Param('lecturerId') lecturerId: string) {
    return this.coursesService.removeLecturer(classId, lecturerId);
  }

  @Get('classes/:classId/lecturers')
  @ApiOperation({ summary: 'Lấy danh sách giảng viên đã phân công của lớp học' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách giảng viên thành công' })
  async findLecturersByClass(@Param('classId') classId: string) {
    return this.coursesService.findLecturersByClass(classId);
  }

  // ==================== STUDENT ENROLLMENT ====================

  @Post('classes/:classId/students')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin gán/ghi danh học viên vào lớp học (Kiểm tra sĩ số & lớp duy nhất cùng khóa)' })
  @ApiResponse({ status: 201, description: 'Ghi danh học viên thành công' })
  async enrollStudent(@Param('classId') classId: string, @Body() dto: EnrollStudentDto) {
    return this.coursesService.enrollStudent(classId, dto);
  }

  @Delete('classes/:classId/students/:studentId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin xóa học viên khỏi lớp học' })
  @ApiResponse({ status: 200, description: 'Xóa học viên khỏi lớp thành công' })
  async removeStudent(@Param('classId') classId: string, @Param('studentId') studentId: string) {
    return this.coursesService.removeStudent(classId, studentId);
  }

  @Get('classes/:classId/students')
  @ApiOperation({ summary: 'Lấy danh sách học viên trong lớp học' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách học viên thành công' })
  async findStudentsByClass(@Param('classId') classId: string) {
    return this.coursesService.findStudentsByClass(classId);
  }

}
