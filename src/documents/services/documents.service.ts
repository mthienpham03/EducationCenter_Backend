import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from '../models/Document.entity';
import { DocumentVersion } from '../models/DocumentVersion.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';
import { CurriculumChapter } from '../../curriculum/models/CurriculumChapter.entity';
import { Enrollment, EnrollmentStatus } from '../../courses/models/Enrollment.entity';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';
import { CloudinaryService } from '../../utils/cloudinary/services/cloudinary.service';
import { UserRole } from '../../users/models/User.entity';
import {
  UploadDocumentDto,
  UpdateDocumentDto,
  UploadVersionDto,
  DocumentVisibility,
} from '../dto/document.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentVersion)
    private readonly versionRepository: Repository<DocumentVersion>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(CurriculumChapter)
    private readonly chapterRepository: Repository<CurriculumChapter>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignmentRepository: Repository<TeachingAssignment>,
    private readonly cloudinaryService: CloudinaryService,
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
    user: { id: string; role: string },
    requireWrite = false,
  ): Promise<void> {
    // Admin: toàn quyền
    if (user.role === UserRole.ADMIN) {
      return;
    }

    // Nếu document không gắn lesson → chỉ admin truy cập được
    if (!document.lessonId) {
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

      // Nếu write, phải là owner hoặc admin
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
        throw new ForbiddenException('Học viên không có quyền chỉnh sửa tài liệu');
      }

      // Document phải là published
      if (document.status !== DocumentStatus.PUBLISHED) {
        throw new ForbiddenException('Tài liệu này chưa được xuất bản');
      }

      // Nếu visibility = public thì cho phép
      if (document.visibility === DocumentVisibility.PUBLIC) {
        return;
      }

      // Nếu enrolled_only: kiểm tra enrollment
      const enrollment = await this.enrollmentRepository.findOne({
        where: {
          studentId: user.id,
          courseId,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      if (!enrollment) {
        throw new ForbiddenException(
          'Bạn chưa ghi danh vào khóa học chứa tài liệu này',
        );
      }
      return;
    }

    throw new ForbiddenException('Bạn không có quyền truy cập tài liệu này');
  }

  // ==================== DOCUMENT CRUD ====================

  async uploadDocument(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    user: { id: string; role: string },
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file để upload');
    }

    // Validate lessonId
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
    const courseId = await this.getCourseIdFromLesson(dto.lessonId);

    if (user.role === UserRole.LECTURER) {
      const assignment = await this.teachingAssignmentRepository.findOne({
        where: { lecturerId: user.id, courseId },
      });
      if (!assignment) {
        throw new ForbiddenException(
          'Bạn không được phân công giảng dạy khóa học này',
        );
      }
    }

    // Upload file lên Cloudinary
    const folder = `educenter/documents/${courseId}/${dto.lessonId}`;
    let uploadResult;
    try {
      uploadResult = await this.cloudinaryService.uploadFile(file, {
        folder,
        resource_type: 'auto',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException('Upload file lên Cloudinary thất bại: ' + msg);
    }

    // Tạo Document record
    const document = this.documentRepository.create({
      lessonId: dto.lessonId,
      ownerId: user.id,
      title: dto.title,
      type: dto.type,
      fileUrl: uploadResult.secure_url,
      visibility: dto.visibility || DocumentVisibility.ENROLLED_ONLY,
      status: dto.status || DocumentStatus.DRAFT,
      createdBy: user.id,
      updatedBy: user.id,
    });

    const savedDoc = await this.documentRepository.save(document);

    // Tạo Version 1
    const version = this.versionRepository.create({
      documentId: savedDoc.id,
      versionNo: 1,
      fileUrl: uploadResult.secure_url,
      changeNote: 'Phiên bản đầu tiên',
      createdBy: user.id,
    });

    await this.versionRepository.save(version);

    return {
      success: true,
      message: 'Upload tài liệu thành công',
      data: {
        ...savedDoc,
        currentVersion: 1,
        cloudinaryUrl: uploadResult.secure_url,
      },
    };
  }

  async findAll(
    query: {
      lessonId?: string;
      chapterId?: string;
      courseId?: string;
      status?: string;
    },
    user: { id: string; role: string },
  ) {
    const qb = this.documentRepository
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.owner', 'owner')
      .leftJoinAndSelect('doc.lesson', 'lesson')
      .leftJoin('lesson.chapter', 'chapter');

    // Filter by lessonId
    if (query.lessonId) {
      qb.andWhere('doc.lesson_id = :lessonId', { lessonId: query.lessonId });
    }

    // Filter by chapterId (qua lesson → chapter)
    if (query.chapterId) {
      qb.andWhere('chapter.id = :chapterId', { chapterId: query.chapterId });
    }

    // Filter by courseId (qua lesson → chapter → course)
    if (query.courseId) {
      qb.andWhere('chapter.course_id = :courseId', { courseId: query.courseId });
    }

    // Filter by status
    if (query.status) {
      qb.andWhere('doc.status = :status', { status: query.status });
    }

    // Role-based filtering
    if (user.role === UserRole.STUDENT) {
      // Students only see published documents
      qb.andWhere('doc.status = :publishedStatus', {
        publishedStatus: DocumentStatus.PUBLISHED,
      });

      // Only see docs belonging to courses they're enrolled in
      // OR documents with visibility = 'public'
      qb.andWhere(
        `(
          doc.visibility = :publicVisibility
          OR EXISTS (
            SELECT 1 FROM enrollments e
            WHERE e.student_id = :studentId
              AND e.course_id = chapter.course_id
              AND e.status = :activeStatus
          )
        )`,
        {
          publicVisibility: DocumentVisibility.PUBLIC,
          studentId: user.id,
          activeStatus: EnrollmentStatus.ACTIVE,
        },
      );
    } else if (user.role === UserRole.LECTURER) {
      // Lecturers see docs belonging to courses they teach
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM teaching_assignments ta
          WHERE ta.lecturer_id = :lecturerId
            AND ta.course_id = chapter.course_id
        )`,
        { lecturerId: user.id },
      );
    }
    // Admin: no extra filter

    qb.orderBy('doc.createdAt', 'DESC');
    const documents = await qb.getMany();

    return {
      success: true,
      data: documents.map((doc) => ({
        id: doc.id,
        lessonId: doc.lessonId,
        title: doc.title,
        type: doc.type,
        fileUrl: doc.fileUrl,
        visibility: doc.visibility,
        status: doc.status,
        owner: doc.owner
          ? {
              id: doc.owner.id,
              fullName: doc.owner.fullName,
              email: doc.owner.email,
            }
          : null,
        lesson: doc.lesson
          ? {
              id: doc.lesson.id,
              title: doc.lesson.title,
            }
          : null,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    };
  }

  async findById(id: string, user: { id: string; role: string }) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({
      where: { id },
      relations: { owner: true, lesson: true, versions: true },
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    await this.checkDocumentAccess(document, user);

    // Sort versions by versionNo descending
    if (document.versions) {
      document.versions.sort((a, b) => b.versionNo - a.versionNo);
    }

    return {
      success: true,
      data: {
        id: document.id,
        lessonId: document.lessonId,
        title: document.title,
        type: document.type,
        fileUrl: document.fileUrl,
        visibility: document.visibility,
        status: document.status,
        owner: document.owner
          ? {
              id: document.owner.id,
              fullName: document.owner.fullName,
              email: document.owner.email,
            }
          : null,
        lesson: document.lesson
          ? {
              id: document.lesson.id,
              title: document.lesson.title,
            }
          : null,
        versions: document.versions.map((v) => ({
          id: v.id,
          versionNo: v.versionNo,
          fileUrl: v.fileUrl,
          changeNote: v.changeNote,
          createdBy: v.createdBy,
          createdAt: v.createdAt,
        })),
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
    };
  }

  async updateDocument(
    id: string,
    dto: UpdateDocumentDto,
    user: { id: string; role: string },
  ) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({
      where: { id },
    });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    await this.checkDocumentAccess(document, user, true);

    Object.assign(document, {
      ...dto,
      updatedBy: user.id,
    });

    const updated = await this.documentRepository.save(document);
    return {
      success: true,
      message: 'Cập nhật tài liệu thành công',
      data: updated,
    };
  }

  async removeDocument(id: string, user: { id: string; role: string }) {
    if (!UUID_REGEX.test(id)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({
      where: { id },
    });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    await this.checkDocumentAccess(document, user, true);

    await this.documentRepository.softRemove(document);
    return {
      success: true,
      message: 'Xóa tài liệu thành công',
    };
  }

  // ==================== VERSION MANAGEMENT ====================

  async uploadVersion(
    documentId: string,
    file: Express.Multer.File,
    dto: UploadVersionDto,
    user: { id: string; role: string },
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file để upload');
    }

    if (!UUID_REGEX.test(documentId)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    await this.checkDocumentAccess(document, user, true);

    // Upload file lên Cloudinary
    let courseId = 'general';
    if (document.lessonId) {
      try {
        courseId = await this.getCourseIdFromLesson(document.lessonId);
      } catch {
        // Fallback to 'general' if lesson/chapter not found
      }
    }

    const folder = `educenter/documents/${courseId}/${document.lessonId || 'no-lesson'}`;
    let uploadResult;
    try {
      uploadResult = await this.cloudinaryService.uploadFile(file, {
        folder,
        resource_type: 'auto',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException('Upload file lên Cloudinary thất bại: ' + msg);
    }

    // Auto-increment versionNo
    const maxResult = await this.versionRepository
      .createQueryBuilder('version')
      .select('COALESCE(MAX(version.version_no), 0)', 'maxVersion')
      .where('version.document_id = :documentId', { documentId })
      .getRawOne();

    const nextVersionNo = (maxResult?.maxVersion ?? 0) + 1;

    // Tạo version record
    const version = this.versionRepository.create({
      documentId,
      versionNo: nextVersionNo,
      fileUrl: uploadResult.secure_url,
      changeNote: dto.changeNote || null,
      createdBy: user.id,
    });

    const savedVersion = await this.versionRepository.save(version);

    // Cập nhật fileUrl trên Document chính (luôn trỏ tới version mới nhất)
    document.fileUrl = uploadResult.secure_url;
    document.updatedBy = user.id;
    await this.documentRepository.save(document);

    return {
      success: true,
      message: `Upload phiên bản ${nextVersionNo} thành công`,
      data: savedVersion,
    };
  }

  async findVersions(
    documentId: string,
    user: { id: string; role: string },
  ) {
    if (!UUID_REGEX.test(documentId)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    await this.checkDocumentAccess(document, user);

    const versions = await this.versionRepository.find({
      where: { documentId },
      relations: { creator: true },
      order: { versionNo: 'DESC' },
    });

    return {
      success: true,
      data: versions.map((v) => ({
        id: v.id,
        versionNo: v.versionNo,
        fileUrl: v.fileUrl,
        changeNote: v.changeNote,
        creator: v.creator
          ? {
              id: v.creator.id,
              fullName: v.creator.fullName,
            }
          : null,
        createdAt: v.createdAt,
      })),
    };
  }

  async findVersionById(
    documentId: string,
    versionId: string,
    user: { id: string; role: string },
  ) {
    if (!UUID_REGEX.test(documentId)) {
      throw new BadRequestException('ID tài liệu không đúng định dạng UUID');
    }
    if (!UUID_REGEX.test(versionId)) {
      throw new BadRequestException('ID phiên bản không đúng định dạng UUID');
    }

    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });
    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu');
    }

    await this.checkDocumentAccess(document, user);

    const version = await this.versionRepository.findOne({
      where: { id: versionId, documentId },
      relations: { creator: true },
    });

    if (!version) {
      throw new NotFoundException('Không tìm thấy phiên bản tài liệu');
    }

    return {
      success: true,
      data: {
        id: version.id,
        versionNo: version.versionNo,
        fileUrl: version.fileUrl,
        changeNote: version.changeNote,
        creator: version.creator
          ? {
              id: version.creator.id,
              fullName: version.creator.fullName,
            }
          : null,
        createdAt: version.createdAt,
      },
    };
  }
}
