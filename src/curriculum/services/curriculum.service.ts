import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CurriculumChapter } from '../models/CurriculumChapter.entity';
import { Lesson } from '../models/Lesson.entity';
import { Course } from '../../courses/models/Course.entity';
import { CreateChapterDto, UpdateChapterDto } from '../dto/chapter.dto';
import { CreateLessonDto, UpdateLessonDto } from '../dto/lesson.dto';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';
import { UserRole } from '../../users/models/User.entity';

@Injectable()
export class CurriculumService {
  constructor(
    @InjectRepository(CurriculumChapter)
    private readonly chapterRepository: Repository<CurriculumChapter>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignmentRepository: Repository<TeachingAssignment>,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== HELPER ====================

  private async checkWritePermission(courseId: string, user: { id: string, role: string }): Promise<void> {
    if (user.role === UserRole.LECTURER) {
      const assignment = await this.teachingAssignmentRepository.findOne({
        where: { lecturerId: user.id, courseId },
      });
      if (!assignment) {
        throw new ForbiddenException('Bạn không được phân công giảng dạy khóa học này');
      }
    }
  }

  private async findCourseOrFail(courseId: string): Promise<Course> {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(courseId)) {
      throw new BadRequestException('ID khóa học không đúng định dạng UUID');
    }
    const course = await this.courseRepository.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học');
    }
    return course;
  }

  private async findChapterOrFail(
    chapterId: string,
    courseId: string,
  ): Promise<CurriculumChapter> {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(chapterId)) {
      throw new BadRequestException('ID chương học không đúng định dạng UUID');
    }
    const chapter = await this.chapterRepository.findOne({
      where: { id: chapterId, courseId },
    });
    if (!chapter) {
      throw new NotFoundException(
        'Không tìm thấy chương học trong khóa học này',
      );
    }
    return chapter;
  }

  private async findLessonOrFail(
    lessonId: string,
    chapterId: string,
  ): Promise<Lesson> {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(lessonId)) {
      throw new BadRequestException('ID bài học không đúng định dạng UUID');
    }
    const lesson = await this.lessonRepository.findOne({
      where: { id: lessonId, chapterId },
    });
    if (!lesson) {
      throw new NotFoundException('Không tìm thấy bài học trong chương này');
    }
    return lesson;
  }

  // ==================== CHAPTER CRUD ====================

  async createChapter(
    courseId: string,
    dto: CreateChapterDto,
    user?: { id: string; role: string },
  ) {
    await this.findCourseOrFail(courseId);
    if (user) await this.checkWritePermission(courseId, user);

    // Auto-assign orderIndex = max + 1
    const maxResult = await this.chapterRepository
      .createQueryBuilder('chapter')
      .select('COALESCE(MAX(chapter.order_index), -1)', 'maxOrder')
      .where('chapter.course_id = :courseId', { courseId })
      .getRawOne();

    const nextOrder = (maxResult?.maxOrder ?? -1) + 1;

    const chapter = this.chapterRepository.create({
      ...dto,
      courseId,
      orderIndex: nextOrder,
      createdBy: user?.id,
      updatedBy: user?.id,
    });

    const saved = await this.chapterRepository.save(chapter);
    return {
      success: true,
      message: 'Tạo chương học thành công',
      data: saved,
    };
  }

  async findChaptersByCourse(courseId: string) {
    await this.findCourseOrFail(courseId);

    const chapters = await this.chapterRepository.find({
      where: { courseId },
      relations: { lessons: true },
      order: { orderIndex: 'ASC', lessons: { orderIndex: 'ASC' } },
    });

    return {
      success: true,
      data: chapters,
    };
  }

  async findChapterById(courseId: string, chapterId: string) {
    await this.findCourseOrFail(courseId);

    const chapter = await this.chapterRepository.findOne({
      where: { id: chapterId, courseId },
      relations: { lessons: true },
    });

    if (!chapter) {
      throw new NotFoundException(
        'Không tìm thấy chương học trong khóa học này',
      );
    }

    // Sort lessons by orderIndex
    if (chapter.lessons) {
      chapter.lessons.sort((a, b) => a.orderIndex - b.orderIndex);
    }

    return {
      success: true,
      data: chapter,
    };
  }

  async updateChapter(
    courseId: string,
    chapterId: string,
    dto: UpdateChapterDto,
    user?: { id: string; role: string },
  ) {
    await this.findCourseOrFail(courseId);
    if (user) await this.checkWritePermission(courseId, user);
    const chapter = await this.findChapterOrFail(chapterId, courseId);

    Object.assign(chapter, {
      ...dto,
      updatedBy: user?.id,
    });

    const updated = await this.chapterRepository.save(chapter);
    return {
      success: true,
      message: 'Cập nhật chương học thành công',
      data: updated,
    };
  }

  async removeChapter(courseId: string, chapterId: string, user?: { id: string; role: string }) {
    await this.findCourseOrFail(courseId);
    if (user) await this.checkWritePermission(courseId, user);
    const chapter = await this.findChapterOrFail(chapterId, courseId);

    // Soft-delete all lessons in this chapter first
    const lessons = await this.lessonRepository.find({
      where: { chapterId },
    });

    if (lessons.length > 0) {
      await this.lessonRepository.softRemove(lessons);
    }

    // Soft-delete the chapter
    await this.chapterRepository.softRemove(chapter);

    return {
      success: true,
      message: 'Xóa chương học thành công',
    };
  }

  async reorderChapters(courseId: string, orderedIds: string[], user?: { id: string; role: string }) {
    await this.findCourseOrFail(courseId);
    if (user) await this.checkWritePermission(courseId, user);

    // Validate all IDs belong to this course
    const chapters = await this.chapterRepository.find({
      where: { courseId },
    });

    const existingIds = new Set(chapters.map((c) => c.id));
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(
          `Chương học với ID "${id}" không tồn tại trong khóa học này`,
        );
      }
    }

    // Check for duplicates
    const uniqueIds = new Set(orderedIds);
    if (uniqueIds.size !== orderedIds.length) {
      throw new BadRequestException('Danh sách ID chứa giá trị trùng lặp');
    }

    // Update orderIndex in a transaction
    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(CurriculumChapter, orderedIds[i], {
          orderIndex: i,
        });
      }
    });

    // Return updated list
    const updated = await this.chapterRepository.find({
      where: { courseId },
      order: { orderIndex: 'ASC' },
    });

    return {
      success: true,
      message: 'Sắp xếp lại chương học thành công',
      data: updated,
    };
  }

  // ==================== LESSON CRUD ====================

  async createLesson(
    courseId: string,
    chapterId: string,
    dto: CreateLessonDto,
    user?: { id: string; role: string },
  ) {
    await this.findCourseOrFail(courseId);
    if (user) await this.checkWritePermission(courseId, user);
    await this.findChapterOrFail(chapterId, courseId);

    // Auto-assign orderIndex = max + 1
    const maxResult = await this.lessonRepository
      .createQueryBuilder('lesson')
      .select('COALESCE(MAX(lesson.order_index), -1)', 'maxOrder')
      .where('lesson.chapter_id = :chapterId', { chapterId })
      .getRawOne();

    const nextOrder = (maxResult?.maxOrder ?? -1) + 1;

    const lesson = this.lessonRepository.create({
      ...dto,
      chapterId,
      orderIndex: nextOrder,
      createdBy: user?.id,
      updatedBy: user?.id,
    });

    const saved = await this.lessonRepository.save(lesson);
    return {
      success: true,
      message: 'Tạo bài học thành công',
      data: saved,
    };
  }

  async findLessonsByChapter(courseId: string, chapterId: string) {
    await this.findCourseOrFail(courseId);
    await this.findChapterOrFail(chapterId, courseId);

    const lessons = await this.lessonRepository.find({
      where: { chapterId },
      order: { orderIndex: 'ASC' },
    });

    return {
      success: true,
      data: lessons,
    };
  }

  async findLessonById(courseId: string, chapterId: string, lessonId: string) {
    await this.findCourseOrFail(courseId);
    await this.findChapterOrFail(chapterId, courseId);
    const lesson = await this.findLessonOrFail(lessonId, chapterId);

    return {
      success: true,
      data: lesson,
    };
  }

  async updateLesson(
    courseId: string,
    chapterId: string,
    lessonId: string,
    dto: UpdateLessonDto,
    user?: { id: string; role: string },
  ) {
    await this.findCourseOrFail(courseId);
    if (user) await this.checkWritePermission(courseId, user);
    await this.findChapterOrFail(chapterId, courseId);
    const lesson = await this.findLessonOrFail(lessonId, chapterId);

    Object.assign(lesson, {
      ...dto,
      updatedBy: user?.id,
    });

    const updated = await this.lessonRepository.save(lesson);
    return {
      success: true,
      message: 'Cập nhật bài học thành công',
      data: updated,
    };
  }

  async removeLesson(courseId: string, chapterId: string, lessonId: string, user?: { id: string; role: string }) {
    await this.findCourseOrFail(courseId);
    if (user) await this.checkWritePermission(courseId, user);
    await this.findChapterOrFail(chapterId, courseId);
    const lesson = await this.findLessonOrFail(lessonId, chapterId);

    await this.lessonRepository.softRemove(lesson);
    return {
      success: true,
      message: 'Xóa bài học thành công',
    };
  }

  async reorderLessons(
    courseId: string,
    chapterId: string,
    orderedIds: string[],
    user?: { id: string; role: string },
  ) {
    await this.findCourseOrFail(courseId);
    if (user) await this.checkWritePermission(courseId, user);
    await this.findChapterOrFail(chapterId, courseId);

    // Validate all IDs belong to this chapter
    const lessons = await this.lessonRepository.find({
      where: { chapterId },
    });

    const existingIds = new Set(lessons.map((l) => l.id));
    for (const id of orderedIds) {
      if (!existingIds.has(id)) {
        throw new BadRequestException(
          `Bài học với ID "${id}" không tồn tại trong chương này`,
        );
      }
    }

    // Check for duplicates
    const uniqueIds = new Set(orderedIds);
    if (uniqueIds.size !== orderedIds.length) {
      throw new BadRequestException('Danh sách ID chứa giá trị trùng lặp');
    }

    // Update orderIndex in a transaction
    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await manager.update(Lesson, orderedIds[i], {
          orderIndex: i,
        });
      }
    });

    // Return updated list
    const updated = await this.lessonRepository.find({
      where: { chapterId },
      order: { orderIndex: 'ASC' },
    });

    return {
      success: true,
      message: 'Sắp xếp lại bài học thành công',
      data: updated,
    };
  }
}
