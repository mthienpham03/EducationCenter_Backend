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
import { QuestionBankService } from '../services/question-bank.service';
import { CreateQuestionDto, UpdateQuestionDto, ReviewQuestionDto } from '../dto/question.dto';

@ApiTags('Question Bank')
@ApiBearerAuth()
@Controller('api/v1/question-bank')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuestionBankController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Admin/Giảng viên tạo câu hỏi mới' })
  @ApiResponse({ status: 201, description: 'Tạo câu hỏi thành công' })
  async createQuestion(@Req() req, @Body() dto: CreateQuestionDto) {
    return this.questionBankService.createQuestion(
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Lấy danh sách câu hỏi trong ngân hàng' })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiQuery({ name: 'lessonId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'approvalStatus', required: false })
  @ApiResponse({ status: 200, description: 'Lấy danh sách thành công' })
  async findQuestions(
    @Req() req,
    @Query('courseId') courseId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('type') type?: string,
    @Query('approvalStatus') approvalStatus?: string,
  ) {
    return this.questionBankService.findQuestions(
      req.user.id,
      req.user.role,
      courseId,
      lessonId,
      type,
      approvalStatus,
    );
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Xem chi tiết một câu hỏi và các đáp án' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết thành công' })
  async findQuestionById(@Req() req, @Param('id') id: string) {
    return this.questionBankService.findQuestionById(
      id,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Cập nhật nội dung câu hỏi và ghi đè đáp án' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  async updateQuestion(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionBankService.updateQuestion(
      id,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin phê duyệt hoặc từ chối câu hỏi của giảng viên' })
  @ApiResponse({ status: 200, description: 'Kiểm duyệt câu hỏi thành công' })
  async reviewQuestion(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: ReviewQuestionDto,
  ) {
    return this.questionBankService.reviewQuestion(
      id,
      dto,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Xóa mềm câu hỏi' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  async removeQuestion(@Req() req, @Param('id') id: string) {
    return this.questionBankService.removeQuestion(
      id,
      req.user.id,
      req.user.role,
    );
  }
}
