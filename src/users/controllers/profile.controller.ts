import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UsersService } from '../services/users.service';
import { CloudinaryService } from '../../utils/cloudinary/services/cloudinary.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { UserRole } from '../models/User.entity';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('api/v1/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy thông tin profile cá nhân' })
  @ApiResponse({ status: 200, description: 'Lấy profile thành công' })
  async getProfile(@Req() req) {
    return this.usersService.getProfile(req.user.id, req.user.role);
  }

  @Patch()
  @ApiOperation({ summary: 'Cập nhật thông tin profile cá nhân' })
  @ApiResponse({ status: 200, description: 'Cập nhật profile thành công' })
  async updateProfile(@Req() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.updateProfile(
      req.user.id,
      req.user.role,
      updateProfileDto,
    );
  }

  @Post('upload-certificate')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Giảng viên upload ảnh chứng chỉ lên Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh chứng chỉ',
        },
      },
    },
  })
  async uploadCertificate(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (req.user.role !== UserRole.LECTURER) {
      throw new BadRequestException(
        'Chỉ giảng viên mới có quyền upload chứng chỉ',
      );
    }

    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh để upload');
    }

    // Tự động tạo folder tương ứng: educenter/lecturers/{lecturer_id}/certificates
    const folder = `educenter/lecturers/${req.user.id}/certificates`;

    try {
      const result = await this.cloudinaryService.uploadFile(file, {
        folder,
        resource_type: 'image',
      });
      return {
        success: true,
        message: 'Upload chứng chỉ thành công',
        data: {
          url: result.secure_url,
          publicId: result.public_id,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException('Upload lên Cloudinary thất bại: ' + msg);
    }
  }

  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload ảnh đại diện (avatar) lên Cloudinary' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File ảnh đại diện',
        },
      },
    },
  })
  async uploadAvatar(@Req() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh để upload');
    }

    const folder = `educenter/users/${req.user.id}/avatar`;

    try {
      const result = await this.cloudinaryService.uploadFile(file, {
        folder,
        resource_type: 'image',
      });
      return {
        success: true,
        message: 'Upload avatar thành công',
        data: {
          url: result.secure_url,
          publicId: result.public_id,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException('Upload avatar thất bại: ' + msg);
    }
  }
}
