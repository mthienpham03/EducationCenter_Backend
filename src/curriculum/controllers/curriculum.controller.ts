import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/models/User.entity';
import { CurriculumService } from '../services/curriculum.service';
import { CreateChapterDto, UpdateChapterDto, ReorderChaptersDto } from '../dto/chapter.dto';
import { CreateLessonDto, UpdateLessonDto, ReorderLessonsDto } from '../dto/lesson.dto';

@ApiTags('Curriculum Management')
@ApiBearerAuth()
@Controller('api/v1/courses/:courseId/chapters')
@UseGuards(JwtAuthGuard)
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  // ==================== CHAPTER CRUD ====================

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin tạo mới một chương học trong khóa học' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiResponse({ status: 201, description: 'Tạo chương học thành công' })
  async createChapter(
    @Req() req,
    @Param('courseId') courseId: string,
    @Body() dto: CreateChapterDto,
  ) {
    return this.curriculumService.createChapter(courseId, dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách chương học của khóa học (kèm bài học, sắp xếp theo vị trí)' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách chương học thành công' })
  async findChaptersByCourse(@Param('courseId') courseId: string) {
    return this.curriculumService.findChaptersByCourse(courseId);
  }

  // Reorder MUST be declared BEFORE :chapterId to avoid route conflict
  @Patch('reorder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin sắp xếp lại vị trí các chương học trong khóa học' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiResponse({ status: 200, description: 'Sắp xếp lại chương học thành công' })
  async reorderChapters(
    @Param('courseId') courseId: string,
    @Body() dto: ReorderChaptersDto,
  ) {
    return this.curriculumService.reorderChapters(courseId, dto.orderedIds);
  }

  @Get(':chapterId')
  @ApiOperation({ summary: 'Lấy chi tiết một chương học (kèm danh sách bài học)' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết chương học thành công' })
  async findChapterById(
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.curriculumService.findChapterById(courseId, chapterId);
  }

  @Patch(':chapterId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin cập nhật thông tin chương học' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiResponse({ status: 200, description: 'Cập nhật chương học thành công' })
  async updateChapter(
    @Req() req,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: UpdateChapterDto,
  ) {
    return this.curriculumService.updateChapter(courseId, chapterId, dto, req.user.id);
  }

  @Delete(':chapterId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin xóa (soft-delete) chương học (kèm xóa các bài học trong chương)' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiResponse({ status: 200, description: 'Xóa chương học thành công' })
  async removeChapter(
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.curriculumService.removeChapter(courseId, chapterId);
  }

  // ==================== LESSON CRUD ====================

  @Post(':chapterId/lessons')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin tạo mới một bài học trong chương' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiResponse({ status: 201, description: 'Tạo bài học thành công' })
  async createLesson(
    @Req() req,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.curriculumService.createLesson(courseId, chapterId, dto, req.user.id);
  }

  @Get(':chapterId/lessons')
  @ApiOperation({ summary: 'Lấy danh sách bài học trong chương (sắp xếp theo vị trí)' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách bài học thành công' })
  async findLessonsByChapter(
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
  ) {
    return this.curriculumService.findLessonsByChapter(courseId, chapterId);
  }

  // Reorder MUST be declared BEFORE :lessonId to avoid route conflict
  @Patch(':chapterId/lessons/reorder')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin sắp xếp lại vị trí các bài học trong chương' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiResponse({ status: 200, description: 'Sắp xếp lại bài học thành công' })
  async reorderLessons(
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Body() dto: ReorderLessonsDto,
  ) {
    return this.curriculumService.reorderLessons(courseId, chapterId, dto.orderedIds);
  }

  @Get(':chapterId/lessons/:lessonId')
  @ApiOperation({ summary: 'Lấy chi tiết một bài học' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiParam({ name: 'lessonId', description: 'ID bài học' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết bài học thành công' })
  async findLessonById(
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.curriculumService.findLessonById(courseId, chapterId, lessonId);
  }

  @Patch(':chapterId/lessons/:lessonId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin cập nhật thông tin bài học' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiParam({ name: 'lessonId', description: 'ID bài học' })
  @ApiResponse({ status: 200, description: 'Cập nhật bài học thành công' })
  async updateLesson(
    @Req() req,
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.curriculumService.updateLesson(courseId, chapterId, lessonId, dto, req.user.id);
  }

  @Delete(':chapterId/lessons/:lessonId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin xóa (soft-delete) bài học' })
  @ApiParam({ name: 'courseId', description: 'ID khóa học' })
  @ApiParam({ name: 'chapterId', description: 'ID chương học' })
  @ApiParam({ name: 'lessonId', description: 'ID bài học' })
  @ApiResponse({ status: 200, description: 'Xóa bài học thành công' })
  async removeLesson(
    @Param('courseId') courseId: string,
    @Param('chapterId') chapterId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.curriculumService.removeLesson(courseId, chapterId, lessonId);
  }
}
