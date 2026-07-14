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
import { Lesson } from '../../curriculum/models/Lesson.entity';
import { CurriculumChapter } from '../../curriculum/models/CurriculumChapter.entity';
import {
  Enrollment,
  EnrollmentStatus,
} from '../../courses/models/Enrollment.entity';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';
import { CloudinaryService } from '../../utils/cloudinary/services/cloudinary.service';
import { UserRole } from '../../users/models/User.entity';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { AddVersionDto } from '../dto/add-version.dto';
import { UploadApiResponse } from 'cloudinary';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

import { DocumentAccess } from '../models/DocumentAccess.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly documentVersionRepository: Repository<DocumentVersion>,
    @InjectRepository(DocumentAccess)
    private readonly documentAccessRepository: Repository<DocumentAccess>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(CurriculumChapter)
    private readonly chapterRepository: Repository<CurriculumChapter>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignmentRepository: Repository<TeachingAssignment>,
    private readonly cloudinaryService: CloudinaryService,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== PERMISSION HELPERS ====================

  /**
   * Lấy courseId từ một lesson (qua chapter)
   */
  private async getCourseIdFromLesson(lessonId: string): Promise<string> {
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId },
    });
    if (!lesson) {
      throw new NotFoundException('Không tìm thấy bài học');
    }

    const chapter = await this.chapterRepository.findOne({
      where: { id: lesson.chapterId },
    });
    if (!chapter) {
      throw new NotFoundException('Không tìm thấy chương học');
    }

    return chapter.courseId;
  }

  /**
   * Kiểm tra quyền truy cập tài liệu theo role
   */
  private async checkDocumentAccess(
    document: Document,
    user: { id: string; role: UserRole },
    requireWrite = false,
  ): Promise<void> {
    // Admin: toàn quyền
    if (user.role === UserRole.ADMIN) {
      return;
    }

    // Nếu document không gắn lesson → chỉ admin truy cập được
    if (!document.lessonId) {
      if (requireWrite && document.ownerId === user.id) {
        return;
      }
      throw new ForbiddenException('Bạn không có quyền truy cập tài liệu này');
    }

    const courseId = await this.getCourseIdFromLesson(document.lessonId);

    if (user.role === UserRole.LECTURER) {
      // Lecturer: phải có TeachingAssignment với course tương ứng
      const assignment = await this.teachingAssignmentRepository.findOne({
        where: { lecturerId: user.id, courseId },
      });

      if (!assignment) {
        throw new ForbiddenException(
          'Bạn không được phân công giảng dạy khóa học chứa tài liệu này',
        );
      }

      // Nếu write, phải là owner
      if (requireWrite && document.ownerId !== user.id) {
        throw new ForbiddenException(
          'Bạn chỉ có quyền chỉnh sửa tài liệu do chính mình tạo',
        );
      }
      return;
    }

    if (user.role === UserRole.STUDENT) {
      // Student: không có quyền write
      if (requireWrite) {
        throw new ForbiddenException(
          'Học viên không có quyền chỉnh sửa tài liệu',
        );
      }

      // 1. draft hoặc archived -> không cho phép
      if (document.status === DocumentStatus.DRAFT || document.status === DocumentStatus.ARCHIVED) {
        throw new ForbiddenException('Tài liệu đang nháp hoặc đã lưu trữ');
      }

      // 2. published + public -> OK
      if (document.status === DocumentStatus.PUBLISHED && document.visibility === 'public') {
        return;
      }

      // 3. published + enrolled -> Check enrollment
      if (document.status === DocumentStatus.PUBLISHED && document.visibility === 'enrolled') {
        const enrollment = await this.enrollmentRepository.findOne({
          where: { studentId: user.id, courseId, status: EnrollmentStatus.ACTIVE },
        });
        if (!enrollment) {
          throw new ForbiddenException('Bạn chưa ghi danh vào khóa học chứa tài liệu này');
        }
        return;
      }

      // 4. restricted + restricted -> Check document_access_list
      if (document.status === DocumentStatus.RESTRICTED && document.visibility === 'restricted') {
        const access = await this.documentAccessRepository.findOne({
          where: { documentId: document.id, studentId: user.id },
        });
        if (!access) {
          throw new ForbiddenException('Bạn không nằm trong danh sách được cấp quyền xem tài liệu này');
        }
        return;
      }

      throw new ForbiddenException('Bạn không có quyền truy cập tài liệu này');
    }

    throw new ForbiddenException('Bạn không có quyền truy cập tài liệu này');
  }

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

  async uploadDocument(
    file: Express.Multer.File,
    dto: CreateDocumentDto,
    user: { id: string; role: UserRole },
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn tệp tin cần tải lên');
    }

    // Validate lessonId & permissions if lessonId is provided
    let courseId = 'general';
    if (dto.lessonId) {
      if (!UUID_REGEX.test(dto.lessonId)) {
        throw new BadRequestException('ID bài học không đúng định dạng UUID');
      }

      const lesson = await this.lessonRepository.findOne({
        where: { id: dto.lessonId },
      });
      if (!lesson) {
        throw new NotFoundException('Không tìm thấy bài học');
      }

      // Check write permission: phải là Admin hoặc Lecturer được phân công
      courseId = await this.getCourseIdFromLesson(dto.lessonId);

      if (user.role === UserRole.LECTURER) {
        const assignment = await this.teachingAssignmentRepository.findOne({
          where: { lecturerId: user.id, courseId },
        });
        if (!assignment) {
          throw new ForbiddenException(
            'Bạn không được phân công giảng dạy khóa học chứa bài học này',
          );
        }
      }
    }

    // 1. Kiểm duyệt định dạng & dung lượng
    const fileType = this.validateAndGetFileType(file);

    // Fix Multer UTF-8 filename encoding issue
    const originalNameUtf8 = Buffer.from(file.originalname, 'latin1').toString('utf8');
    
    // 2. Xác định tiêu đề mặc định nếu trống
    const title =
      dto.title || this.getFileNameWithoutExtension(originalNameUtf8);

    // 3. Upload file lên Cloudinary
    let uploadResult: UploadApiResponse;
    try {
      let resourceType: 'image' | 'video' | 'raw' = 'raw';
      if (fileType === 'Video') {
        resourceType = 'video';
      }

      const fileExtension = file.originalname
        .substring(file.originalname.lastIndexOf('.'))
        .toLowerCase();
      const uniqueFilename = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const publicId =
        resourceType === 'raw'
          ? `${uniqueFilename}${fileExtension}`
          : uniqueFilename;

      uploadResult = await this.cloudinaryService.uploadFile(file, {
        resource_type: resourceType,
        folder: `educenter/documents/${courseId}/${dto.lessonId || 'no-lesson'}`,
        public_id: publicId,
      });
    } catch (error: unknown) {
      console.error('Lỗi khi tải file lên Cloudinary:', error);
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `Không thể tải file lên hệ thống lưu trữ Cloudinary: ${msg}`,
      );
    }

    // 4. Lưu database sử dụng Transaction để đảm bảo tính toàn vẹn dữ liệu
    return await this.dataSource.transaction(async (manager) => {
      // Tạo bản ghi Document
      const document = manager.create(Document, {
        lessonId: dto.lessonId || null,
        ownerId: user.id,
        title: title,
        type: fileType,
        fileUrl: uploadResult.secure_url,
        visibility: dto.visibility || 'restricted',
        status: dto.status || DocumentStatus.DRAFT,
        createdBy: user.id,
        updatedBy: user.id,
      });

      const savedDoc = await manager.save(Document, document);

      // Tạo bản ghi DocumentVersion đầu tiên (versionNo = 1)
      const documentVersion = manager.create(DocumentVersion, {
        documentId: savedDoc.id,
        versionNo: 1,
        fileUrl: uploadResult.secure_url,
        changeNote: 'Phiên bản khởi tạo đầu tiên',
        createdBy: user.id,
      });

      await manager.save(DocumentVersion, documentVersion);

      // Trả về đối tượng đầy đủ
      return {
        success: true,
        message: 'Upload tài liệu thành công',
        data: {
          ...savedDoc,
          versions: [documentVersion],
        },
      };
    });
  }

  async findAll(
    query: {
      search?: string;
      status?: string;
      visibility?: string;
      lessonId?: string;
      chapterId?: string;
      courseId?: string;
    },
    user: { id: string; role: UserRole },
  ) {
    const qb = this.documentRepository
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.owner', 'owner')
      .leftJoinAndSelect('doc.versions', 'versions')
      .leftJoinAndSelect('doc.lesson', 'lesson')
      .leftJoin('lesson.chapter', 'chapter');

    // Lọc theo từ khóa tìm kiếm (tiêu đề tài liệu)
    if (query.search) {
      qb.andWhere('doc.title ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    // Lọc theo bài học, chương, khóa học
    if (query.lessonId) {
      qb.andWhere('doc.lessonId = :lessonId', { lessonId: query.lessonId });
    }
    if (query.chapterId) {
      qb.andWhere('chapter.id = :chapterId', { chapterId: query.chapterId });
    }
    if (query.courseId) {
      qb.andWhere('chapter.courseId = :courseId', { courseId: query.courseId });
    }

    if (query.status) {
      qb.andWhere('doc.status = :status', { status: query.status });
    }
    if (query.visibility) {
      qb.andWhere('doc.visibility = :visibility', {
        visibility: query.visibility,
      });
    }

    // Role-based filtering
    if (user.role === UserRole.STUDENT) {
      qb.andWhere(
        `(
          (doc.status = :publishedStatus AND doc.visibility = 'public')
          OR
          (doc.status = :publishedStatus AND doc.visibility = 'enrolled' AND EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.student_id = :studentId
              AND e.course_id = chapter.course_id
              AND e.status = :activeStatus
          ))
          OR
          (doc.status = :restrictedStatus AND doc.visibility = 'restricted' AND EXISTS (
            SELECT 1 FROM document_access_list dal
            WHERE dal.student_id = :studentId
              AND dal.document_id = doc.id
          ))
        )`,
        {
          publishedStatus: DocumentStatus.PUBLISHED,
          restrictedStatus: DocumentStatus.RESTRICTED,
          studentId: user.id,
          activeStatus: EnrollmentStatus.ACTIVE,
        },
      );
    } else if (user.role === UserRole.LECTURER) {
      // Lecturers see docs belonging to courses they teach, OR their own
      qb.andWhere(
        `(
          doc.ownerId = :lecturerId
          OR EXISTS (
            SELECT 1 FROM teaching_assignments ta
            WHERE ta.lecturer_id = :lecturerId
              AND ta.course_id = chapter.course_id
          )
        )`,
        { lecturerId: user.id },
      );
    }

    qb.orderBy('doc.createdAt', 'DESC');
    const documents = await qb.getMany();

    return {
      success: true,
      data: documents,
    };
  }

  async findOne(id: string, user: { id: string; role: UserRole }) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({
      where: { id },
      relations: { owner: true, versions: true, lesson: true },
      order: { versions: { versionNo: 'DESC' } },
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    await this.checkDocumentAccess(document, user);

    return {
      success: true,
      data: document,
    };
  }

  async update(
    id: string,
    dto: UpdateDocumentDto,
    user: { id: string; role: UserRole },
  ) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu cần cập nhật');
    }

    await this.checkDocumentAccess(document, user, true);

    Object.assign(document, {
      ...dto,
      updatedBy: user.id,
    });

    const updated = await this.documentRepository.save(document);
    return {
      success: true,
      message: 'Cập nhật thông tin tài liệu thành công',
      data: updated,
    };
  }

  async remove(id: string, user: { id: string; role: UserRole }) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({ where: { id } });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu cần xóa');
    }

    await this.checkDocumentAccess(document, user, true);

    await this.documentRepository.softRemove(document);
    return {
      success: true,
      message: 'Xóa tài liệu thành công',
    };
  }

  async addVersion(
    documentId: string,
    file: Express.Multer.File,
    dto: AddVersionDto,
    user: { id: string; role: UserRole },
  ) {
    if (!file) {
      throw new BadRequestException(
        'Vui lòng chọn tệp tin phiên bản mới cần tải lên',
      );
    }

    if (!UUID_REGEX.test(documentId)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
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

    await this.checkDocumentAccess(document, user, true);

    // 2. Kiểm duyệt định dạng & dung lượng
    const fileType = this.validateAndGetFileType(file);
    if (fileType !== document.type) {
      throw new BadRequestException(
        `Tệp tin mới không cùng định dạng với tài liệu hiện tại (Yêu cầu định dạng: ${document.type})`,
      );
    }

    // Upload file lên Cloudinary
    let courseId = 'general';
    if (document.lessonId) {
      try {
        courseId = await this.getCourseIdFromLesson(document.lessonId);
      } catch {
        // Fallback to 'general' if lesson/chapter not found
      }
    }

    let uploadResult: UploadApiResponse;
    try {
      // PDF -> raw (truy cập trực tiếp được), Video -> video, PPT -> raw
      let resourceType: 'image' | 'video' | 'raw' = 'raw';
      if (fileType === 'Video') {
        resourceType = 'video';
      }

      const fileExtension = file.originalname
        .substring(file.originalname.lastIndexOf('.'))
        .toLowerCase();
      const uniqueFilename = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      const publicId =
        resourceType === 'raw'
          ? `${uniqueFilename}${fileExtension}`
          : uniqueFilename;

      uploadResult = await this.cloudinaryService.uploadFile(file, {
        resource_type: resourceType,
        folder: `educenter/documents/${courseId}/${document.lessonId || 'no-lesson'}`,
        public_id: publicId,
      });
    } catch (error: unknown) {
      console.error('Lỗi khi tải file lên Cloudinary:', error);
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `Không thể tải file lên hệ thống lưu trữ Cloudinary: ${msg}`,
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
        createdBy: user.id,
      });

      const savedVersion = await manager.save(DocumentVersion, newVersion);

      // Cập nhật fileUrl mới nhất lên bản ghi chính
      document.fileUrl = uploadResult.secure_url;
      document.updatedBy = user.id;
      await manager.save(Document, document);

      return {
        success: true,
        message: `Đã cập nhật lên phiên bản ${nextVersionNo} thành công`,
        data: savedVersion,
      };
    });
  }
}
