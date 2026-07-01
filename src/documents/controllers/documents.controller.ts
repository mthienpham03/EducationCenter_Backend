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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/models/User.entity';
import { DocumentsService } from '../services/documents.service';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { AddVersionDto } from '../dto/add-version.dto';

interface RequestWithUser {
  user: {
    id: string;
    role: UserRole;
  };
}

@ApiTags('Documents Management')
@ApiBearerAuth()
@Controller('api/v1/documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Admin hoặc Giảng viên tải lên tài liệu mới (PDF/PPT/Video)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Tệp tin tải lên (PDF tối đa 10MB, PPT tối đa 20MB, Video tối đa 50MB)',
        },
        lessonId: {
          type: 'string',
          description: 'ID của bài học liên kết (tùy chọn)',
        },
        title: {
          type: 'string',
          description: 'Tiêu đề tài liệu (tùy chọn, mặc định lấy tên tệp gốc)',
        },
        visibility: {
          type: 'string',
          description:
            'Chế độ hiển thị (public / restricted, mặc định là restricted)',
          default: 'restricted',
        },
        status: {
          type: 'string',
          description:
            'Trạng thái tài liệu (draft / published / restricted / archived, mặc định là draft)',
          default: 'draft',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Tải lên tài liệu thành công' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.uploadDocument(file, dto, req.user);
  }

  @Post(':id/versions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Admin hoặc Giảng viên sở hữu tải lên một phiên bản mới của tài liệu',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Tệp tin phiên bản mới (cùng định dạng với tệp gốc)',
        },
        changeNote: {
          type: 'string',
          description: 'Mô tả ngắn về các thay đổi (tùy chọn)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Tải lên phiên bản mới thành công' })
  async addVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddVersionDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.addVersion(id, file, dto, req.user);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách tài liệu có phân trang và bộ lọc theo vai trò (RBAC)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Tìm kiếm theo tên tài liệu',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'Trạng thái tài liệu (draft / published / restricted / archived)',
  })
  @ApiQuery({
    name: 'visibility',
    required: false,
    description: 'Quyền xem (public / restricted)',
  })
  @ApiQuery({
    name: 'lessonId',
    required: false,
    description: 'Lọc theo ID bài học liên kết',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy danh sách tài liệu thành công',
  })
  async findAll(
    @Req() req: RequestWithUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('visibility') visibility?: string,
    @Query('lessonId') lessonId?: string,
    @Query('chapterId') chapterId?: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.documentsService.findAll(
      { search, status, visibility, lessonId, chapterId, courseId },
      req.user,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết thông tin một tài liệu và lịch sử các phiên bản',
  })
  @ApiResponse({
    status: 200,
    description: 'Lấy thông tin tài liệu thành công',
  })
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cập nhật metadata thông tin của tài liệu' })
  @ApiResponse({ status: 200, description: 'Cập nhật tài liệu thành công' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
    @Req() req: RequestWithUser,
  ) {
    return this.documentsService.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Xóa tài liệu (soft-delete)' })
  @ApiResponse({ status: 200, description: 'Xóa tài liệu thành công' })
  async remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.documentsService.remove(id, req.user);
  }
}
