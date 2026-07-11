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
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/models/User.entity';
import { QuizzesService } from '../services/quizzes.service';
import {
  CreateQuizDto,
  UpdateQuizDto,
  UpdateQuizStatusDto,
  AddQuizQuestionDto,
  AddMultipleQuestionsDto,
  SubmitQuizDto,
} from '../dto/quiz.dto';

@ApiTags('Quiz Configuration')
@ApiBearerAuth()
@Controller('api/v1/quizzes')
@UseGuards(JwtAuthGuard)
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  // ==================== QUIZ CRUD ====================

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Tạo mới quiz (Admin / Giảng viên). Giảng viên chỉ tạo được quiz trong khóa mình dạy.' })
  @ApiResponse({ status: 201, description: 'Tạo quiz thành công' })
  @ApiResponse({ status: 403, description: 'Giảng viên không được phân công khóa học này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy khóa học / bài học' })
  async createQuiz(@Req() req, @Body() dto: CreateQuizDto) {
    return this.quizzesService.createQuiz(dto, req.user.id, req.user.role);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách quiz. Admin: tất cả. Giảng viên: chỉ khóa được phân công. Học viên: chỉ quiz OPEN trong khóa đã ghi danh.',
  })
  @ApiQuery({ name: 'courseId', required: false, description: 'Lọc theo ID khóa học' })
  @ApiQuery({ name: 'lessonId', required: false, description: 'Lọc theo ID bài học' })
  @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái (chỉ Admin/Giảng viên)' })
  @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm theo tiêu đề quiz' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách quiz thành công' })
  async findAllQuizzes(
    @Req() req,
    @Query('courseId') courseId?: string,
    @Query('lessonId') lessonId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.quizzesService.findAllQuizzes(
      { courseId, lessonId, status, search },
      req.user.id,
      req.user.role,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết quiz (bao gồm số lượng câu hỏi)' })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiResponse({ status: 200, description: 'Lấy thông tin quiz thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy quiz' })
  async findQuizById(@Param('id') id: string) {
    return this.quizzesService.findQuizById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Cập nhật cấu hình quiz (tiêu đề, thời gian, số lần làm, cờ ngẫu nhiên, trạng thái)' })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiResponse({ status: 200, description: 'Cập nhật quiz thành công' })
  @ApiResponse({ status: 403, description: 'Giảng viên không được phân công khóa học này' })
  @ApiResponse({ status: 400, description: 'Không thể chỉnh sửa quiz đã archived' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy quiz' })
  async updateQuiz(@Req() req, @Param('id') id: string, @Body() dto: UpdateQuizDto) {
    return this.quizzesService.updateQuiz(id, dto, req.user.id, req.user.role);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Cập nhật trạng thái quiz (draft → open → closed → archived). Mở quiz yêu cầu có ít nhất 1 câu hỏi.' })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  @ApiResponse({ status: 400, description: 'Không thể mở quiz khi không có câu hỏi' })
  @ApiResponse({ status: 403, description: 'Giảng viên không được phân công khóa học này' })
  async updateQuizStatus(@Req() req, @Param('id') id: string, @Body() dto: UpdateQuizStatusDto) {
    return this.quizzesService.updateQuizStatus(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Xóa quiz (soft-delete). Không thể xóa quiz đang mở (open).' })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiResponse({ status: 200, description: 'Xóa quiz thành công' })
  @ApiResponse({ status: 400, description: 'Không thể xóa quiz đang open' })
  @ApiResponse({ status: 403, description: 'Giảng viên không được phân công khóa học này' })
  async removeQuiz(@Req() req, @Param('id') id: string) {
    return this.quizzesService.removeQuiz(id, req.user.id, req.user.role);
  }

  // ==================== QUIZ QUESTIONS ====================

  @Get(':id/questions')
  @ApiOperation({
    summary:
      'Lấy danh sách câu hỏi trong quiz (kèm options). Học viên không thấy trường isCorrect.',
  })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách câu hỏi thành công' })
  @ApiResponse({ status: 403, description: 'Học viên chưa ghi danh hoặc quiz chưa mở' })
  async getQuizQuestions(@Req() req, @Param('id') id: string) {
    return this.quizzesService.getQuizQuestions(id, req.user.id, req.user.role);
  }

  @Post(':id/questions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Thêm một câu hỏi vào quiz từ ngân hàng câu hỏi' })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiResponse({ status: 201, description: 'Thêm câu hỏi thành công' })
  @ApiResponse({ status: 409, description: 'Câu hỏi đã tồn tại trong quiz' })
  async addQuestionToQuiz(@Req() req, @Param('id') id: string, @Body() dto: AddQuizQuestionDto) {
    return this.quizzesService.addQuestionToQuiz(id, dto, req.user.id, req.user.role);
  }

  @Post(':id/questions/bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Thêm nhiều câu hỏi vào quiz cùng lúc (bulk)' })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiResponse({ status: 201, description: 'Kết quả thêm hàng loạt câu hỏi' })
  async addMultipleQuestionsToQuiz(@Req() req, @Param('id') id: string, @Body() dto: AddMultipleQuestionsDto) {
    return this.quizzesService.addMultipleQuestionsToQuiz(id, dto, req.user.id, req.user.role);
  }

  @Delete(':id/questions/:questionId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Xóa một câu hỏi khỏi quiz' })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiParam({ name: 'questionId', description: 'ID của câu hỏi cần xóa' })
  @ApiResponse({ status: 200, description: 'Xóa câu hỏi khỏi quiz thành công' })
  async removeQuestionFromQuiz(
    @Req() req,
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    return this.quizzesService.removeQuestionFromQuiz(id, questionId, req.user.id, req.user.role);
  }

  // ==================== ATTEMPT: START & SUBMIT ====================

  @Post(':id/attempts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary:
      'Học viên bắt đầu làm quiz (Start Quiz). Hệ thống trả về đề bài (không có isCorrect). Nếu đang có lượt làm dở sẽ tiếp tục lượt cũ.',
  })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiResponse({ status: 201, description: 'Bắt đầu làm quiz thành công, trả về attemptId và câu hỏi' })
  @ApiResponse({ status: 400, description: 'Quiz chưa mở hoặc đã hết lượt làm' })
  @ApiResponse({ status: 403, description: 'Học viên chưa ghi danh vào khóa học' })
  async startQuiz(@Req() req, @Param('id') id: string) {
    return this.quizzesService.startQuiz(id, req.user.id);
  }

  @Post(':id/attempts/:attemptId/submit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STUDENT)
  @ApiOperation({
    summary:
      'Học viên nộp bài (Submit Quiz). Hệ thống tự chấm điểm và trả về kết quả chi tiết từng câu.',
  })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiParam({ name: 'attemptId', description: 'ID của lượt làm bài (lấy từ Start Quiz)' })
  @ApiResponse({ status: 201, description: 'Nộp bài thành công, trả về điểm và kết quả từng câu' })
  @ApiResponse({ status: 400, description: 'Đã nộp trước đó hoặc quá thời gian' })
  @ApiResponse({ status: 403, description: 'Lượt làm không thuộc về học viên này' })
  async submitQuiz(
    @Req() req,
    @Param('id') id: string,
    @Param('attemptId') attemptId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quizzesService.submitQuiz(id, attemptId, req.user.id, dto);
  }

  // ==================== ATTEMPT HISTORY ====================

  @Get(':id/attempts')
  @ApiOperation({
    summary:
      'Xem lịch sử làm bài. Học viên: chỉ xem của chính mình. Admin/Giảng viên: cần truyền ?studentId=',
  })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiQuery({ name: 'studentId', required: false, description: 'ID học viên (Admin/Giảng viên cung cấp)' })
  @ApiResponse({ status: 200, description: 'Lịch sử làm bài' })
  async getAttemptHistory(
    @Req() req,
    @Param('id') id: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.quizzesService.getAttemptHistory(id, req.user.id, req.user.role, studentId);
  }

  @Get(':id/attempts/:attemptId')
  @ApiOperation({ summary: 'Xem chi tiết một lượt làm bài (kèm câu trả lời và đáp án đúng)' })
  @ApiParam({ name: 'id', description: 'ID của quiz' })
  @ApiParam({ name: 'attemptId', description: 'ID của lượt làm bài' })
  @ApiResponse({ status: 200, description: 'Chi tiết lượt làm bài' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem lượt làm này' })
  async getAttemptDetail(
    @Req() req,
    @Param('id') id: string,
    @Param('attemptId') attemptId: string,
  ) {
    return this.quizzesService.getAttemptDetail(id, attemptId, req.user.id, req.user.role);
  }
}
