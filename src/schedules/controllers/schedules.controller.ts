import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { SchedulesService } from '../services/schedules.service';
import { CreateScheduleDto, UpdateScheduleDto } from '../dto/schedule.dto';
import { AutoGenerateScheduleDto } from '../dto/auto-generate-schedule.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/models/User.entity';

@ApiTags('Schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tạo lịch dạy mới (Có kiểm tra trùng lịch giảng viên)' })
  @ApiResponse({ status: 201, description: 'Tạo lịch dạy thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc giảng viên bị trùng lịch.' })
  async createSchedule(@Body() dto: CreateScheduleDto, @Req() req: any) {
    return this.schedulesService.createSchedule(dto, req.user.id);
  }

  @Post('auto-generate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tự động tạo lịch học theo danh sách bài học của khóa' })
  @ApiResponse({ status: 201, description: 'Tạo lịch học hàng loạt thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc bị trùng lịch.' })
  async autoGenerateSchedules(@Body() dto: AutoGenerateScheduleDto, @Req() req: any) {
    return this.schedulesService.autoGenerateSchedules(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách lịch dạy' })
  @ApiQuery({ name: 'lecturerId', required: false })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiResponse({ status: 200, description: 'Thành công.' })
  async findAll(
    @Query('lecturerId') lecturerId?: string,
    @Query('classId') classId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.schedulesService.findAllSchedules(lecturerId, classId, courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết lịch dạy' })
  @ApiResponse({ status: 200, description: 'Thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lịch dạy.' })
  async findOne(@Param('id') id: string) {
    return this.schedulesService.findScheduleById(id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật lịch dạy (Có kiểm tra trùng lịch)' })
  @ApiResponse({ status: 200, description: 'Cập nhật lịch dạy thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ hoặc giảng viên bị trùng lịch.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lịch dạy.' })
  async updateSchedule(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
    @Req() req: any,
  ) {
    return this.schedulesService.updateSchedule(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa (hủy) lịch dạy' })
  @ApiResponse({ status: 200, description: 'Xóa lịch dạy thành công.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy lịch dạy.' })
  async remove(@Param('id') id: string) {
    return this.schedulesService.removeSchedule(id);
  }
}
