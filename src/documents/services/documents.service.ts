import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Document, DocumentStatus } from '../models/Document.entity';
import { DocumentVersion } from '../models/DocumentVersion.entity';
import { CloudinaryService } from '../../utils/cloudinary/services/cloudinary.service';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { AddVersionDto } from '../dto/add-version.dto';
import { UserRole } from '../../users/models/User.entity';
import { UploadApiResponse } from 'cloudinary';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly documentVersionRepository: Repository<DocumentVersion>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly dataSource: DataSource,
  ) { }

  /**
   * Kiểm tra định dạng và dung lượng file, trả về loại tài liệu (PDF, PPT, Video)
   */
  private validateAndGetFileType(file: Express.Multer.File): string {
    const filename = file.originalname.toLowerCase();
    const mimetype = file.mimetype.toLowerCase();
    const size = file.size; // bytes

    // 1. PDF
    if (mimetype === 'application/pdf' || filename.endsWith('.pdf')) {
      const maxPdfSize = 10 * 1024 * 1024; // 10MB
      if (size > maxPdfSize) {
        throw new BadRequestException(
          'Tệp tin PDF vượt quá kích thước giới hạn 10MB',
        );
      }
      return 'PDF';
    }

    // 2. PPT / PPTX
    if (
      mimetype === 'application/vnd.ms-powerpoint' ||
      mimetype ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      filename.endsWith('.ppt') ||
      filename.endsWith('.pptx')
    ) {
      const maxPptSize = 20 * 1024 * 1024; // 20MB
      if (size > maxPptSize) {
        throw new BadRequestException(
          'Tệp tin PowerPoint (PPT/PPTX) vượt quá kích thước giới hạn 20MB',
        );
      }
      return 'PPT';
    }

    // 3. Video
    if (
      mimetype.startsWith('video/') ||
      filename.endsWith('.mp4') ||
      filename.endsWith('.mov') ||
      filename.endsWith('.avi') ||
      filename.endsWith('.mkv')
    ) {
      const maxVideoSize = 50 * 1024 * 1024; // 50MB
      if (size > maxVideoSize) {
        throw new BadRequestException(
          'Tệp tin Video vượt quá kích thước giới hạn 50MB',
        );
      }
      return 'Video';
    }

    throw new BadRequestException(
      'Định dạng tệp tin không hợp lệ. Chỉ chấp nhận tệp tin PDF, PPT, PPTX hoặc Video',
    );
  }

  /**
   * Tách lấy tên file gốc bỏ phần mở rộng
   */
  private getFileNameWithoutExtension(originalname: string): string {
    const lastDotIndex = originalname.lastIndexOf('.');
    if (lastDotIndex === -1) return originalname;
    return originalname.substring(0, lastDotIndex);
  }

  /**
   * Tạo tài liệu mới và lưu phiên bản đầu tiên (version 1)
   */
  async uploadDocument(
    file: Express.Multer.File,
    dto: CreateDocumentDto,
    userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp tin cần tải lên');
    }

    // 1. Kiểm duyệt định dạng & dung lượng
    const fileType = this.validateAndGetFileType(file);

    // 2. Xác định tiêu đề mặc định nếu trống
    const title =
      dto.title || this.getFileNameWithoutExtension(file.originalname);

    // 3. Upload file lên Cloudinary
    let uploadResult: UploadApiResponse;
    try {
      let resourceType: 'image' | 'video' | 'raw' = 'raw';
      if (fileType === 'Video') {
        resourceType = 'video';
      }

      const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
      const uniqueFilename = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      // Video: Cloudinary tự append extension. raw (PDF/PPT): cần append thủ công.
      const publicId = resourceType === 'raw' ? `${uniqueFilename}${fileExtension}` : uniqueFilename;
      uploadResult = await this.cloudinaryService.uploadFile(file, {
        resource_type: resourceType,
        folder: `educenter/documents/${fileType.toLowerCase()}s`,
        public_id: publicId,
      });
    } catch (error: any) {
      console.error('Lỗi khi tải file lên Cloudinary:', error);
      throw new BadRequestException(
        `Không thể tải file lên hệ thống lưu trữ Cloudinary: ${error?.message || error || ''}`,
      );
    }

    // 4. Lưu database sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
    return await this.dataSource.transaction(async (manager) => {
      // Tạo bản ghi Document
      const document = manager.create(Document, {
        lessonId: dto.lessonId || null,
        ownerId: userId,
        title: title,
        type: fileType,
        fileUrl: uploadResult.secure_url,
        visibility: dto.visibility || 'restricted',
        status: dto.status || DocumentStatus.DRAFT,
        createdBy: userId,
        updatedBy: userId,
      });

      const savedDoc = await manager.save(Document, document);

      // Tạo bản ghi DocumentVersion đầu tiên (versionNo = 1)
      const documentVersion = manager.create(DocumentVersion, {
        documentId: savedDoc.id,
        versionNo: 1,
        fileUrl: uploadResult.secure_url,
        changeNote: 'Phiên bản khởi tạo đầu tiên',
        createdBy: userId,
      });

      await manager.save(DocumentVersion, documentVersion);

      // Trả về đối tượng đầy đủ
      return {
        ...savedDoc,
        versions: [documentVersion],
      };
    });
  }

  /**
   * Tải lên một phiên bản mới (mới hơn) của tài liệu hiện có
   */
  async addVersion(
    documentId: string,
    file: Express.Multer.File,
    dto: AddVersionDto,
    userId: string,
    userRole: UserRole,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Vui lòng chọn tệp tin phiên bản mới cần tải lên',
      );
    }

    // 1. Tìm tài liệu cũ
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException(
        'Không tìm thấy tài liệu cần cập nhật phiên bản',
      );
    }

    // Kiểm soát quyền: Giảng viên chỉ được thêm phiên bản vào tài liệu của chính mình
    if (userRole === UserRole.LECTURER && document.ownerId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền cập nhật phiên bản cho tài liệu này',
      );
    }

    // 2. Kiểm duyệt định dạng & dung lượng
    const fileType = this.validateAndGetFileType(file);
    if (fileType !== document.type) {
      throw new BadRequestException(
        `Tệp tin mới không cùng định dạng với tài liệu hiện tại (Yêu cầu định dạng: ${document.type})`,
      );
    }

    // 3. Upload lên Cloudinary
    let uploadResult: UploadApiResponse;
    try {
      // PDF -> raw (truy cập trực tiếp được), Video -> video, PPT -> raw
      let resourceType: 'image' | 'video' | 'raw' = 'raw';
      if (fileType === 'Video') {
        resourceType = 'video';
      }

      const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
      const uniqueFilename = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      // Video: Cloudinary tự append extension. raw (PDF/PPT): cần append thủ công.
      const publicId = resourceType === 'raw' ? `${uniqueFilename}${fileExtension}` : uniqueFilename;

      uploadResult = await this.cloudinaryService.uploadFile(file, {
        resource_type: resourceType,
        folder: `educenter/documents/${fileType.toLowerCase()}s`,
        public_id: publicId,
      });
    } catch (error: any) {
      console.error('Lỗi khi tải file lên Cloudinary:', error);
      throw new BadRequestException(
        `Không thể tải file lên hệ thống lưu trữ Cloudinary: ${error?.message || error || ''}`,
      );
    }

    // 4. Lưu database trong Transaction
    return await this.dataSource.transaction(async (manager) => {
      // Tìm số thứ tự phiên bản lớn nhất hiện tại
      const latestVersion = await manager.findOne(DocumentVersion, {
        where: { documentId },
        order: { versionNo: 'DESC' },
      });

      const nextVersionNo = latestVersion ? latestVersion.versionNo + 1 : 1;

      // Tạo DocumentVersion mới
      const newVersion = manager.create(DocumentVersion, {
        documentId,
        versionNo: nextVersionNo,
        fileUrl: uploadResult.secure_url,
        changeNote: dto.changeNote || `Cập nhật lên phiên bản ${nextVersionNo}`,
        createdBy: userId,
      });

      const savedVersion = await manager.save(DocumentVersion, newVersion);

      // Cập nhật fileUrl mới nhất lên bản ghi chính
      document.fileUrl = uploadResult.secure_url;
      document.updatedBy = userId;
      await manager.save(Document, document);

      return {
        success: true,
        message: `Đã cập nhật lên phiên bản ${nextVersionNo} thành công`,
        data: savedVersion,
      };
    });
  }

  /**
   * Lấy danh sách tài liệu với phân quyền RBAC và các bộ lọc tìm kiếm
   */
  async findAll(
    query: {
      search?: string;
      status?: string;
      visibility?: string;
      lessonId?: string;
    },
    userId: string,
    userRole: UserRole,
  ) {
    const qb = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.owner', 'owner')
      .leftJoinAndSelect('document.versions', 'versions');

    // Lọc theo từ khóa tìm kiếm (tiêu đề tài liệu)
    if (query.search) {
      qb.andWhere('document.title ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // Lọc theo liên kết bài học
    if (query.lessonId) {
      qb.andWhere('document.lessonId = :lessonId', {
        lessonId: query.lessonId,
      });
    }

    // Áp dụng bộ lọc trạng thái và hiển thị dựa theo vai trò (RBAC Scoping)
    if (userRole === UserRole.ADMIN) {
      // Admin xem được tất cả
      if (query.status) {
        qb.andWhere('document.status = :status', { status: query.status });
      }
      if (query.visibility) {
        qb.andWhere('document.visibility = :visibility', {
          visibility: query.visibility,
        });
      }
    } else if (userRole === UserRole.LECTURER) {
      // Giảng viên xem được tài liệu của chính mình tải lên hoặc tài liệu ở chế độ public
      qb.andWhere(
        `(document.ownerId = :userId OR document.visibility = 'public')`,
        { userId },
      );

      if (query.status) {
        qb.andWhere('document.status = :status', { status: query.status });
      }
    } else if (userRole === UserRole.STUDENT) {
      // Học viên chỉ được xem tài liệu đã xuất bản (published)
      qb.andWhere('document.status = :publishedStatus', {
        publishedStatus: DocumentStatus.PUBLISHED,
      });

      // Học viên chỉ xem tài liệu ở chế độ 'public' HOẶC 'restricted' có liên kết bài học mà học viên đã ghi danh
      qb.andWhere(
        `(document.visibility = 'public' OR 
          (document.visibility = 'restricted' AND document.lessonId IS NOT NULL AND EXISTS (
            SELECT 1 FROM enrollments enrollment
            INNER JOIN lessons lesson ON lesson.id = document.lesson_id
            INNER JOIN curriculum_chapters chapter ON chapter.id = lesson.chapter_id
            WHERE enrollment.student_id = :userId AND enrollment.course_id = chapter.course_id AND enrollment.status = 'active'
          ))
         )`,
        { userId },
      );
    }

    qb.orderBy('document.createdAt', 'DESC');
    const documents = await qb.getMany();

    return {
      success: true,
      data: documents,
    };
  }

  /**
   * Xem chi tiết thông tin và lịch sử phiên bản của một tài liệu
   */
  async findOne(id: string, userId: string, userRole: UserRole) {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: { owner: true, versions: true },
      order: { versions: { versionNo: 'DESC' } },
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    // Kiểm tra quyền truy cập chi tiết đối với Học viên
    if (userRole === UserRole.STUDENT) {
      if (document.status !== DocumentStatus.PUBLISHED) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập tài liệu này',
        );
      }

      if (document.visibility === 'restricted') {
        if (!document.lessonId) {
          throw new ForbiddenException(
            'Tài liệu bị giới hạn truy cập và chưa liên kết bài học nào',
          );
        }

        // Kiểm tra học viên có đăng ký khóa học chứa bài học đó không
        const isEnrolled = await this.dataSource
          .getRepository(Document)
          .createQueryBuilder('doc')
          .where('doc.id = :id', { id })
          .andWhere(
            `EXISTS (
            SELECT 1 FROM enrollments enrollment
            INNER JOIN lessons lesson ON lesson.id = doc.lesson_id
            INNER JOIN curriculum_chapters chapter ON chapter.id = lesson.chapter_id
            WHERE enrollment.student_id = :userId AND enrollment.course_id = chapter.course_id AND enrollment.status = 'active'
          )`,
          )
          .setParameters({ userId })
          .getOne();

        if (!isEnrolled) {
          throw new ForbiddenException(
            'Bạn không có quyền truy cập tài liệu thuộc lớp học chưa đăng ký',
          );
        }
      }
    }

    return {
      success: true,
      data: document,
    };
  }

  /**
   * Cập nhật metadata tài liệu (tiêu đề, chế độ hiển thị, trạng thái)
   */
  async update(
    id: string,
    dto: UpdateDocumentDto,
    userId: string,
    userRole: UserRole,
  ) {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu cần cập nhật');
    }

    // Kiểm soát quyền: Giảng viên chỉ được sửa tài liệu của chính mình
    if (userRole === UserRole.LECTURER && document.ownerId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền cập nhật thông tin tài liệu này',
      );
    }

    Object.assign(document, {
      ...dto,
      updatedBy: userId,
    });

    const updated = await this.documentRepository.save(document);
    return {
      success: true,
      message: 'Cập nhật thông tin tài liệu thành công',
      data: updated,
    };
  }

  /**
   * Soft-delete xóa tài liệu
   */
  async remove(id: string, userId: string, userRole: UserRole) {
    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu cần xóa');
    }

    // Kiểm soát quyền: Giảng viên chỉ được xóa tài liệu của chính mình
    if (userRole === UserRole.LECTURER && document.ownerId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xóa tài liệu này');
    }

    await this.documentRepository.softRemove(document);
    return {
      success: true,
      message: 'Xóa tài liệu thành công',
    };
  }
}
