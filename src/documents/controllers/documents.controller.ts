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
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/models/User.entity';
import { DocumentsService } from '../services/documents.service';
import { UploadDocumentDto, UpdateDocumentDto, UploadVersionDto } from '../dto/document.dto';

@ApiTags('Documents & Versioning')
@ApiBearerAuth()
@Controller('api/v1/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // ==================== DOCUMENT CRUD ====================

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Admin/Giảng viên upload tài liệu mới (gắn vào bài học)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'lessonId', 'title', 'type'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File tài liệu (PDF, DOC, image, video, ...)',
        },
        lessonId: {
          type: 'string',
          description: 'ID bài học gắn tài liệu (UUID)',
          example: 'uuid-lesson-id',
        },
        title: {
          type: 'string',
          description: 'Tiêu đề tài liệu',
          example: 'Slide bài giảng Chương 1',
        },
        type: {
          type: 'string',
          enum: ['pdf', 'doc', 'video', 'image', 'slide', 'other'],
          description: 'Loại tài liệu',
          example: 'pdf',
        },
        visibility: {
          type: 'string',
          enum: ['public', 'enrolled_only'],
          description: 'Quyền xem (mặc định: enrolled_only)',
          example: 'enrolled_only',
        },
        status: {
          type: 'string',
          enum: ['draft', 'published', 'restricted', 'archived'],
          description: 'Trạng thái (mặc định: draft)',
          example: 'draft',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Upload tài liệu thành công' })
  async uploadDocument(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.uploadDocument(file, dto, req.user);
  }

  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách tài liệu (lọc theo bài/chương/khóa học, phân quyền theo vai trò)',
  })
  @ApiQuery({ name: 'lessonId', required: false, description: 'Lọc theo ID bài học' })
  @ApiQuery({ name: 'chapterId', required: false, description: 'Lọc theo ID chương học' })
  @ApiQuery({ name: 'courseId', required: false, description: 'Lọc theo ID khóa học' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Lọc theo trạng thái (draft/published/restricted/archived)',
  })
  @ApiResponse({ status: 200, description: 'Lấy danh sách tài liệu thành công' })
  async findAll(
    @Req() req,
    @Query('lessonId') lessonId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('courseId') courseId?: string,
    @Query('status') status?: string,
  ) {
    return this.documentsService.findAll(
      { lessonId, chapterId, courseId, status },
      req.user,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết tài liệu kèm danh sách phiên bản (kiểm tra quyền)' })
  @ApiParam({ name: 'id', description: 'ID tài liệu' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết tài liệu thành công' })
  async findById(@Req() req, @Param('id') id: string) {
    return this.documentsService.findById(id, req.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Admin/Giảng viên cập nhật metadata tài liệu (title, visibility, status)' })
  @ApiParam({ name: 'id', description: 'ID tài liệu' })
  @ApiResponse({ status: 200, description: 'Cập nhật tài liệu thành công' })
  async updateDocument(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.updateDocument(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @ApiOperation({ summary: 'Admin/Giảng viên xóa (soft-delete) tài liệu' })
  @ApiParam({ name: 'id', description: 'ID tài liệu' })
  @ApiResponse({ status: 200, description: 'Xóa tài liệu thành công' })
  async removeDocument(@Req() req, @Param('id') id: string) {
    return this.documentsService.removeDocument(id, req.user);
  }

  // ==================== VERSION MANAGEMENT ====================

  @Post(':documentId/versions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.LECTURER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Admin/Giảng viên upload phiên bản mới cho tài liệu (auto-increment versionNo)',
  })
  @ApiParam({ name: 'documentId', description: 'ID tài liệu' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File phiên bản mới',
        },
        changeNote: {
          type: 'string',
          description: 'Ghi chú thay đổi',
          example: 'Cập nhật slide 5-10, thêm bài tập',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Upload phiên bản mới thành công' })
  async uploadVersion(
    @Req() req,
    @Param('documentId') documentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVersionDto,
  ) {
    return this.documentsService.uploadVersion(documentId, file, dto, req.user);
  }

  @Get(':documentId/versions')
  @ApiOperation({ summary: 'Lấy danh sách phiên bản của tài liệu (kiểm tra quyền)' })
  @ApiParam({ name: 'documentId', description: 'ID tài liệu' })
  @ApiResponse({ status: 200, description: 'Lấy danh sách phiên bản thành công' })
  async findVersions(
    @Req() req,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.findVersions(documentId, req.user);
  }

  @Get(':documentId/versions/:versionId')
  @ApiOperation({ summary: 'Lấy chi tiết một phiên bản tài liệu (kiểm tra quyền)' })
  @ApiParam({ name: 'documentId', description: 'ID tài liệu' })
  @ApiParam({ name: 'versionId', description: 'ID phiên bản' })
  @ApiResponse({ status: 200, description: 'Lấy chi tiết phiên bản thành công' })
  async findVersionById(
    @Req() req,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documentsService.findVersionById(documentId, versionId, req.user);
  }
}
