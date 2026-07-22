import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QuestionBank, QuestionStatus } from '../models/QuestionBank.entity';
import { QuestionOption } from '../models/QuestionOption.entity';
import { Course } from '../../courses/models/Course.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';
import { UserRole } from '../../users/models/User.entity';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  QuestionTypeEnum,
} from '../dto/question.dto';

@Injectable()
export class QuestionBankService {
  constructor(
    @InjectRepository(QuestionBank)
    private readonly questionBankRepository: Repository<QuestionBank>,
    @InjectRepository(QuestionOption)
    private readonly questionOptionRepository: Repository<QuestionOption>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignmentRepository: Repository<TeachingAssignment>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Kiểm tra quyền của giảng viên đối với Course.
   * Admin thì bỏ qua. Giảng viên phải được phân công vào khóa này.
   */
  private async checkLecturerPermission(
    userId: string,
    role: string,
    courseId: string,
  ) {
    if (role === UserRole.ADMIN) return true;
    if (role !== UserRole.LECTURER) return false;

    const assignment = await this.teachingAssignmentRepository.findOne({
      where: { lecturerId: userId, courseId },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên khóa học này',
      );
    }
    return true;
  }

  private validateOptions(type: QuestionTypeEnum, options: any[]) {
    if (type === QuestionTypeEnum.TRUE_FALSE) {
      if (options.length !== 2) {
        throw new BadRequestException('Câu hỏi Đúng/Sai phải có đúng 2 đáp án');
      }
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException('Câu hỏi Đúng/Sai phải có 1 đáp án đúng');
      }
    } else if (type === QuestionTypeEnum.MCQ_SINGLE) {
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        throw new BadRequestException(
          'Trắc nghiệm 1 đáp án phải có duy nhất 1 đáp án đúng',
        );
      }
    } else if (type === QuestionTypeEnum.MCQ_MULTIPLE) {
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount < 1) {
        throw new BadRequestException(
          'Trắc nghiệm nhiều đáp án phải có ít nhất 1 đáp án đúng',
        );
      }
    }
  }

  async createQuestion(dto: CreateQuestionDto, userId: string, role: string) {
    if (!dto.courseId && !dto.lessonId) {
      throw new BadRequestException(
        'Câu hỏi phải thuộc về một khóa học hoặc một bài học',
      );
    }

    let targetCourseId = dto.courseId;

    // Nếu truyền lessonId, kiểm tra bài học có tồn tại không và lấy courseId từ đó
    if (dto.lessonId) {
      const lesson = await this.lessonRepository.findOne({
        where: { id: dto.lessonId },
        relations: { chapter: true },
      });
      if (!lesson || !lesson.chapter) {
        throw new NotFoundException('Không tìm thấy bài học');
      }
      targetCourseId = lesson.chapter.courseId;

      if (dto.courseId && dto.courseId !== targetCourseId) {
        throw new BadRequestException(
          'courseId truyền vào không khớp với courseId của bài học',
        );
      }
    }

    if (!targetCourseId) {
      throw new BadRequestException('Không xác định được khóa học');
    }

    // Check quyền
    await this.checkLecturerPermission(userId, role, targetCourseId);

    // Validate options
    this.validateOptions(dto.questionType, dto.options);

    // Dùng Transaction để lưu Câu hỏi và Đáp án
    return await this.dataSource.transaction(async (manager) => {
      const newQuestion = manager.create(QuestionBank, {
        courseId: targetCourseId,
        lessonId: dto.lessonId || null,
        questionType: dto.questionType,
        content: dto.content,
        difficulty: dto.difficulty,
        status: role === UserRole.LECTURER ? QuestionStatus.PENDING : (dto.status || QuestionStatus.ACTIVE),
        createdBy: userId,
        updatedBy: userId,
      });

      const savedQuestion = await manager.save(QuestionBank, newQuestion);

      const optionsToSave = dto.options.map((opt, index) =>
        manager.create(QuestionOption, {
          questionId: savedQuestion.id,
          content: opt.content,
          isCorrect: opt.isCorrect,
          orderIndex: opt.orderIndex ?? index,
        }),
      );

      await manager.save(QuestionOption, optionsToSave);

      return {
        success: true,
        message: 'Tạo câu hỏi thành công',
        data: { ...savedQuestion, options: optionsToSave },
      };
    });
  }

  async findQuestions(
    userId: string,
    role: string,
    courseId?: string,
    lessonId?: string,
    type?: string,
  ) {
    // Nếu là Giảng viên, chỉ được lấy câu hỏi của các khóa mà họ dạy
    let allowedCourseIds: string[] = [];
    if (role === UserRole.LECTURER) {
      const assignments = await this.teachingAssignmentRepository.find({
        where: { lecturerId: userId },
      });
      allowedCourseIds = assignments.map((a) => a.courseId);
      if (allowedCourseIds.length === 0) {
        return { success: true, data: [] }; // Không dạy khóa nào thì rỗng
      }

      if (courseId && !allowedCourseIds.includes(courseId)) {
        throw new ForbiddenException(
          'Bạn không có quyền truy cập khóa học này',
        );
      }
    }

    const queryBuilder = this.questionBankRepository
      .createQueryBuilder('qb')
      .leftJoinAndSelect('qb.options', 'options')
      .leftJoinAndSelect('qb.course', 'course')
      .orderBy('qb.createdAt', 'DESC')
      .addOrderBy('options.orderIndex', 'ASC');

    if (courseId) {
      queryBuilder.andWhere('qb.courseId = :courseId', { courseId });
    } else if (role === UserRole.LECTURER) {
      queryBuilder.andWhere('qb.courseId IN (:...allowedCourseIds)', {
        allowedCourseIds,
      });
    }

    if (lessonId) {
      queryBuilder.andWhere('qb.lessonId = :lessonId', { lessonId });
    }

    if (type) {
      queryBuilder.andWhere('qb.questionType = :type', { type });
    }

    const questions = await queryBuilder.getMany();
    return {
      success: true,
      data: questions,
    };
  }

  async findQuestionById(id: string, userId: string, role: string) {
    const question = await this.questionBankRepository.findOne({
      where: { id },
      relations: { options: true },
    });

    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }

    if (question.courseId) {
      await this.checkLecturerPermission(userId, role, question.courseId);
    }

    // Sắp xếp options theo orderIndex
    question.options.sort((a, b) => a.orderIndex - b.orderIndex);

    return {
      success: true,
      data: question,
    };
  }

  async updateQuestion(
    id: string,
    dto: UpdateQuestionDto,
    userId: string,
    role: string,
  ) {
    const question = await this.questionBankRepository.findOne({
      where: { id },
      relations: { options: true },
    });

    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }

    if (question.courseId) {
      await this.checkLecturerPermission(userId, role, question.courseId);
    }

    if (role === UserRole.LECTURER && dto.status && dto.status !== QuestionStatus.PENDING) {
      throw new ForbiddenException('Giảng viên không có quyền thay đổi trạng thái câu hỏi thành đã duyệt');
    }

    const newType = dto.questionType || question.questionType;
    if (dto.options) {
      this.validateOptions(newType as QuestionTypeEnum, dto.options);
    }

    return await this.dataSource.transaction(async (manager) => {
      Object.assign(question, {
        questionType: newType,
        content: dto.content ?? question.content,
        difficulty: dto.difficulty ?? question.difficulty,
        status: dto.status ?? question.status,
        updatedBy: userId,
      });

      const updatedQuestion = await manager.save(QuestionBank, question);

      // Nếu có truyền mảng options mới -> Xóa sạch options cũ và lưu lại từ đầu
      if (dto.options && dto.options.length > 0) {
        await manager.delete(QuestionOption, { questionId: id });

        const optionsToSave = dto.options.map((opt, index) =>
          manager.create(QuestionOption, {
            questionId: id,
            content: opt.content,
            isCorrect: opt.isCorrect,
            orderIndex: opt.orderIndex ?? index,
          }),
        );
        await manager.save(QuestionOption, optionsToSave);
        updatedQuestion.options = optionsToSave;
      }

      return {
        success: true,
        message: 'Cập nhật câu hỏi thành công',
        data: updatedQuestion,
      };
    });
  }

  async removeQuestion(id: string, userId: string, role: string) {
    const question = await this.questionBankRepository.findOne({
      where: { id },
    });

    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi');
    }

    if (question.courseId) {
      await this.checkLecturerPermission(userId, role, question.courseId);
    }

    await this.questionBankRepository.softRemove(question);

    return {
      success: true,
      message: 'Xóa câu hỏi thành công',
    };
  }
}
