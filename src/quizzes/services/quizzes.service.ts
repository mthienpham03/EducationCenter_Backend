import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz, QuizStatus } from '../models/Quiz.entity';
import { QuizQuestion } from '../models/QuizQuestion.entity';
import { QuestionBank } from '../models/QuestionBank.entity';
import { Course } from '../../courses/models/Course.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';
import {
  CreateQuizDto,
  UpdateQuizDto,
  UpdateQuizStatusDto,
  AddQuizQuestionDto,
  AddMultipleQuestionsDto,
} from '../dto/quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,
    @InjectRepository(QuizQuestion)
    private readonly quizQuestionRepository: Repository<QuizQuestion>,
    @InjectRepository(QuestionBank)
    private readonly questionBankRepository: Repository<QuestionBank>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {}

  // ==================== QUIZ CRUD ====================

  async createQuiz(dto: CreateQuizDto, creatorId?: string) {
    // Validate course exists
    const course = await this.courseRepository.findOne({ where: { id: dto.courseId } });
    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học tương ứng');
    }

    // Validate lesson if provided
    if (dto.lessonId) {
      const lesson = await this.lessonRepository.findOne({ where: { id: dto.lessonId } });
      if (!lesson) {
        throw new NotFoundException('Không tìm thấy bài học tương ứng');
      }
    }

    const quiz = this.quizRepository.create({
      courseId: dto.courseId,
      lessonId: dto.lessonId ?? null,
      title: dto.title,
      durationMinutes: dto.durationMinutes ?? null,
      maxAttempts: dto.maxAttempts ?? 1,
      shuffleQuestions: dto.shuffleQuestions ?? false,
      status: dto.status ?? QuizStatus.DRAFT,
      createdBy: creatorId ?? null,
      updatedBy: creatorId ?? null,
    });

    const saved = await this.quizRepository.save(quiz);
    return {
      success: true,
      message: 'Tạo quiz thành công',
      data: saved,
    };
  }

  async findAllQuizzes(params: {
    courseId?: string;
    lessonId?: string;
    status?: string;
    search?: string;
  }) {
    const qb = this.quizRepository
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.course', 'course')
      .leftJoinAndSelect('quiz.lesson', 'lesson')
      .where('quiz.deleted_at IS NULL');

    if (params.courseId) {
      qb.andWhere('quiz.courseId = :courseId', { courseId: params.courseId });
    }
    if (params.lessonId) {
      qb.andWhere('quiz.lessonId = :lessonId', { lessonId: params.lessonId });
    }
    if (params.status) {
      qb.andWhere('quiz.status = :status', { status: params.status });
    }
    if (params.search) {
      qb.andWhere('quiz.title ILIKE :search', { search: `%${params.search}%` });
    }

    qb.orderBy('quiz.createdAt', 'DESC');
    const quizzes = await qb.getMany();

    return {
      success: true,
      data: quizzes,
    };
  }

  async findQuizById(id: string) {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: { course: true, lesson: true },
    });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    // Count questions
    const questionCount = await this.quizQuestionRepository.count({ where: { quizId: id } });

    return {
      success: true,
      data: { ...quiz, questionCount },
    };
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, updaterId?: string) {
    const quiz = await this.quizRepository.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    // Prevent editing a closed/archived quiz config
    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestException('Không thể chỉnh sửa quiz đã được lưu trữ (archived)');
    }

    // Validate lessonId if explicitly set
    if (dto.lessonId !== undefined && dto.lessonId !== null) {
      const lesson = await this.lessonRepository.findOne({ where: { id: dto.lessonId } });
      if (!lesson) {
        throw new NotFoundException('Không tìm thấy bài học tương ứng');
      }
    }

    Object.assign(quiz, {
      ...dto,
      updatedBy: updaterId ?? quiz.updatedBy,
    });

    const updated = await this.quizRepository.save(quiz);
    return {
      success: true,
      message: 'Cập nhật quiz thành công',
      data: updated,
    };
  }

  async updateQuizStatus(id: string, dto: UpdateQuizStatusDto, updaterId?: string) {
    const quiz = await this.quizRepository.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    // Business logic: can only open quiz if it has at least 1 question
    if (dto.status === QuizStatus.OPEN) {
      const questionCount = await this.quizQuestionRepository.count({ where: { quizId: id } });
      if (questionCount === 0) {
        throw new BadRequestException(
          'Không thể mở quiz khi chưa có câu hỏi nào. Vui lòng thêm ít nhất 1 câu hỏi.',
        );
      }
    }

    quiz.status = dto.status;
    quiz.updatedBy = updaterId ?? quiz.updatedBy;
    const updated = await this.quizRepository.save(quiz);

    return {
      success: true,
      message: `Cập nhật trạng thái quiz thành "${dto.status}" thành công`,
      data: updated,
    };
  }

  async removeQuiz(id: string) {
    const quiz = await this.quizRepository.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (quiz.status === QuizStatus.OPEN) {
      throw new BadRequestException(
        'Không thể xóa quiz đang mở (open). Vui lòng đóng quiz trước.',
      );
    }

    await this.quizRepository.softRemove(quiz);
    return {
      success: true,
      message: 'Xóa quiz thành công',
    };
  }

  // ==================== QUIZ QUESTIONS ====================

  async getQuizQuestions(quizId: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    const questions = await this.quizQuestionRepository.find({
      where: { quizId },
      relations: { question: { options: true } },
      order: { orderIndex: 'ASC' },
    });

    const totalScore = questions.reduce((sum, q) => sum + (q.score ?? 0), 0);

    return {
      success: true,
      data: {
        quizId,
        title: quiz.title,
        shuffleQuestions: quiz.shuffleQuestions,
        questionCount: questions.length,
        totalScore,
        questions: questions.map((qq) => ({
          questionId: qq.questionId,
          orderIndex: qq.orderIndex,
          score: qq.score,
          content: qq.question?.content,
          questionType: qq.question?.questionType,
          difficulty: qq.question?.difficulty,
          options: qq.question?.options ?? [],
        })),
      },
    };
  }

  async addQuestionToQuiz(quizId: string, dto: AddQuizQuestionDto) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestException('Không thể thêm câu hỏi vào quiz đã được lưu trữ');
    }

    // Validate question exists in question bank
    const question = await this.questionBankRepository.findOne({
      where: { id: dto.questionId },
    });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi trong ngân hàng câu hỏi');
    }

    // Check if already added
    const existing = await this.quizQuestionRepository.findOne({
      where: { quizId, questionId: dto.questionId },
    });
    if (existing) {
      throw new ConflictException('Câu hỏi này đã có trong quiz');
    }

    // Auto-determine orderIndex if not provided
    let orderIndex = dto.orderIndex;
    if (orderIndex === undefined || orderIndex === null) {
      const count = await this.quizQuestionRepository.count({ where: { quizId } });
      orderIndex = count; // 0-based, so next = count
    }

    const quizQuestion = this.quizQuestionRepository.create({
      quizId,
      questionId: dto.questionId,
      score: dto.score ?? 1,
      orderIndex,
    });

    const saved = await this.quizQuestionRepository.save(quizQuestion);
    return {
      success: true,
      message: 'Thêm câu hỏi vào quiz thành công',
      data: saved,
    };
  }

  async addMultipleQuestionsToQuiz(quizId: string, dto: AddMultipleQuestionsDto) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestException('Không thể thêm câu hỏi vào quiz đã được lưu trữ');
    }

    const currentCount = await this.quizQuestionRepository.count({ where: { quizId } });

    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < dto.questions.length; i++) {
      const item = dto.questions[i];

      const question = await this.questionBankRepository.findOne({
        where: { id: item.questionId },
      });
      if (!question) {
        errors.push({ questionId: item.questionId, error: 'Không tìm thấy trong ngân hàng câu hỏi' });
        continue;
      }

      const existing = await this.quizQuestionRepository.findOne({
        where: { quizId, questionId: item.questionId },
      });
      if (existing) {
        errors.push({ questionId: item.questionId, error: 'Đã tồn tại trong quiz' });
        continue;
      }

      const quizQuestion = this.quizQuestionRepository.create({
        quizId,
        questionId: item.questionId,
        score: item.score ?? 1,
        orderIndex: item.orderIndex ?? currentCount + results.length,
      });
      const saved = await this.quizQuestionRepository.save(quizQuestion);
      results.push(saved);
    }

    return {
      success: true,
      message: `Đã thêm ${results.length}/${dto.questions.length} câu hỏi vào quiz`,
      data: { added: results, errors },
    };
  }

  async removeQuestionFromQuiz(quizId: string, questionId: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestException('Không thể xóa câu hỏi khỏi quiz đã được lưu trữ');
    }

    const quizQuestion = await this.quizQuestionRepository.findOne({
      where: { quizId, questionId },
    });
    if (!quizQuestion) {
      throw new NotFoundException('Câu hỏi này không có trong quiz');
    }

    await this.quizQuestionRepository.remove(quizQuestion);
    return {
      success: true,
      message: 'Xóa câu hỏi khỏi quiz thành công',
    };
  }
}
