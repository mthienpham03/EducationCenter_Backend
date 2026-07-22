import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import Redis from 'ioredis';
import { Quiz, QuizStatus } from '../models/Quiz.entity';
import { QuizQuestion } from '../models/QuizQuestion.entity';
import { QuizAttempt } from '../models/QuizAttempt.entity';
import { QuizAnswer } from '../models/QuizAnswer.entity';
import { QuestionBank } from '../models/QuestionBank.entity';
import { QuestionOption } from '../models/QuestionOption.entity';
import { Course } from '../../courses/models/Course.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';
import { Enrollment, EnrollmentStatus } from '../../courses/models/Enrollment.entity';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';
import { UserRole } from '../../users/models/User.entity';
import {
  CreateQuizDto,
  UpdateQuizDto,
  UpdateQuizStatusDto,
  AddQuizQuestionDto,
  AddMultipleQuestionsDto,
  SubmitQuizDto,
} from '../dto/quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,
    @InjectRepository(QuizQuestion)
    private readonly quizQuestionRepository: Repository<QuizQuestion>,
    @InjectRepository(QuizAttempt)
    private readonly quizAttemptRepository: Repository<QuizAttempt>,
    @InjectRepository(QuizAnswer)
    private readonly quizAnswerRepository: Repository<QuizAnswer>,
    @InjectRepository(QuestionBank)
    private readonly questionBankRepository: Repository<QuestionBank>,
    @InjectRepository(QuestionOption)
    private readonly questionOptionRepository: Repository<QuestionOption>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignmentRepository: Repository<TeachingAssignment>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ==================== HELPERS ====================

  /** Kiểm tra giảng viên có được phân công vào khóa học của quiz không */
  private async assertLecturerOwnsQuizCourse(lecturerId: string, courseId: string) {
    const assignment = await this.teachingAssignmentRepository.findOne({
      where: { lecturerId, courseId },
    });
    if (!assignment) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác quiz của khóa học này. Bạn chưa được phân công giảng dạy khóa học tương ứng.',
      );
    }
  }

  /** Kiểm tra học viên có ghi danh (active) vào khóa học không */
  private async assertStudentEnrolled(studentId: string, courseId: string) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { studentId, courseId, status: EnrollmentStatus.ACTIVE },
    });
    if (!enrollment) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập quiz này. Bạn chưa được ghi danh vào khóa học tương ứng.',
      );
    }
  }

  // ==================== QUIZ CRUD ====================

  async createQuiz(dto: CreateQuizDto, creatorId: string, creatorRole: string) {
    // Validate course exists
    const course = await this.courseRepository.findOne({ where: { id: dto.courseId } });
    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học tương ứng');
    }

    // Giảng viên chỉ tạo quiz trong khóa mình dạy
    if (creatorRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(creatorId, dto.courseId);
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
      createdBy: creatorId,
      updatedBy: creatorId,
    });

    const saved = await this.quizRepository.save(quiz);
    return {
      success: true,
      message: 'Tạo quiz thành công',
      data: saved,
    };
  }

  async findAllQuizzes(
    params: { courseId?: string; lessonId?: string; status?: string; search?: string },
    requesterId: string,
    requesterRole: string,
  ) {
    const qb = this.quizRepository
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.course', 'course')
      .leftJoinAndSelect('quiz.lesson', 'lesson')
      .where('quiz.deleted_at IS NULL');

    // Học viên chỉ thấy quiz đang OPEN trong khóa mình đã ghi danh
    if (requesterRole === UserRole.STUDENT) {
      qb.andWhere('quiz.status = :open', { open: QuizStatus.OPEN });
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM enrollments e
          WHERE e.course_id = quiz.course_id
            AND e.student_id = :studentId
            AND e.status = :enrollStatus
        )`,
        { studentId: requesterId, enrollStatus: EnrollmentStatus.ACTIVE },
      );
    }

    // Giảng viên chỉ thấy quiz trong khóa mình được phân công
    if (requesterRole === UserRole.LECTURER) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM teaching_assignments ta
          WHERE ta.course_id = quiz.course_id
            AND ta.lecturer_id = :lecturerId
        )`,
        { lecturerId: requesterId },
      );
    }

    if (params.courseId) {
      qb.andWhere('quiz.courseId = :courseId', { courseId: params.courseId });
    }
    if (params.lessonId) {
      qb.andWhere('quiz.lessonId = :lessonId', { lessonId: params.lessonId });
    }
    if (params.status && requesterRole !== UserRole.STUDENT) {
      // Học viên không được override filter status
      qb.andWhere('quiz.status = :status', { status: params.status });
    }
    if (params.search) {
      qb.andWhere('quiz.title ILIKE :search', { search: `%${params.search}%` });
    }

    qb.orderBy('quiz.createdAt', 'DESC');
    const quizzes = await qb.getMany();

    return { success: true, data: quizzes };
  }

  async findQuizById(id: string) {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: { course: true, lesson: true },
    });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    const questionCount = await this.quizQuestionRepository.count({ where: { quizId: id } });

    return {
      success: true,
      data: { ...quiz, questionCount },
    };
  }

  async updateQuiz(id: string, dto: UpdateQuizDto, updaterId: string, updaterRole: string) {
    const quiz = await this.quizRepository.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestException('Không thể chỉnh sửa quiz đã được lưu trữ (archived)');
    }

    // Giảng viên chỉ sửa quiz trong khóa mình dạy
    if (updaterRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(updaterId, quiz.courseId);
    }

    if (dto.lessonId !== undefined && dto.lessonId !== null) {
      const lesson = await this.lessonRepository.findOne({ where: { id: dto.lessonId } });
      if (!lesson) {
        throw new NotFoundException('Không tìm thấy bài học tương ứng');
      }
    }

    Object.assign(quiz, { ...dto, updatedBy: updaterId });

    const updated = await this.quizRepository.save(quiz);
    return {
      success: true,
      message: 'Cập nhật quiz thành công',
      data: updated,
    };
  }

  async updateQuizStatus(id: string, dto: UpdateQuizStatusDto, updaterId: string, updaterRole: string) {
    const quiz = await this.quizRepository.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (updaterRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(updaterId, quiz.courseId);
    }

    if (dto.status === QuizStatus.OPEN) {
      const questionCount = await this.quizQuestionRepository.count({ where: { quizId: id } });
      if (questionCount === 0) {
        throw new BadRequestException(
          'Không thể mở quiz khi chưa có câu hỏi nào. Vui lòng thêm ít nhất 1 câu hỏi.',
        );
      }
    }

    quiz.status = dto.status;
    quiz.updatedBy = updaterId;
    const updated = await this.quizRepository.save(quiz);

    return {
      success: true,
      message: `Cập nhật trạng thái quiz thành "${dto.status}" thành công`,
      data: updated,
    };
  }

  async removeQuiz(id: string, removerId: string, removerRole: string) {
    const quiz = await this.quizRepository.findOne({ where: { id } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (removerRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(removerId, quiz.courseId);
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

  async getQuizQuestions(quizId: string, requesterId: string, requesterRole: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    // Học viên chỉ xem câu hỏi nếu quiz đang OPEN và đã ghi danh
    if (requesterRole === UserRole.STUDENT) {
      if (quiz.status !== QuizStatus.OPEN) {
        throw new ForbiddenException('Quiz này hiện không mở để xem.');
      }
      await this.assertStudentEnrolled(requesterId, quiz.courseId);
    }

    if (requesterRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(requesterId, quiz.courseId);
    }

    const questions = await this.quizQuestionRepository.find({
      where: { quizId },
      relations: { question: { options: true } },
      order: { orderIndex: 'ASC' },
    });

    const totalScore = questions.reduce((sum, q) => sum + (q.score ?? 0), 0);
    const isStudent = requesterRole === UserRole.STUDENT;

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
          // Ẩn isCorrect với học viên
          options: (qq.question?.options ?? []).map((opt) => ({
            id: opt.id,
            content: opt.content,
            orderIndex: opt.orderIndex,
            ...(isStudent ? {} : { isCorrect: opt.isCorrect }),
          })),
        })),
      },
    };
  }

  async addQuestionToQuiz(quizId: string, dto: AddQuizQuestionDto, actorId: string, actorRole: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestException('Không thể thêm câu hỏi vào quiz đã được lưu trữ');
    }

    if (actorRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(actorId, quiz.courseId);
    }

    const question = await this.questionBankRepository.findOne({ where: { id: dto.questionId } });
    if (!question) {
      throw new NotFoundException('Không tìm thấy câu hỏi trong ngân hàng câu hỏi');
    }

    const existing = await this.quizQuestionRepository.findOne({
      where: { quizId, questionId: dto.questionId },
    });
    if (existing) {
      throw new ConflictException('Câu hỏi này đã có trong quiz');
    }

    let orderIndex = dto.orderIndex;
    if (orderIndex === undefined || orderIndex === null) {
      const count = await this.quizQuestionRepository.count({ where: { quizId } });
      orderIndex = count;
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

  async addMultipleQuestionsToQuiz(quizId: string, dto: AddMultipleQuestionsDto, actorId: string, actorRole: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestException('Không thể thêm câu hỏi vào quiz đã được lưu trữ');
    }

    if (actorRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(actorId, quiz.courseId);
    }

    const currentCount = await this.quizQuestionRepository.count({ where: { quizId } });
    const results: any[] = [];
    const errors: any[] = [];

    for (let i = 0; i < dto.questions.length; i++) {
      const item = dto.questions[i];

      const question = await this.questionBankRepository.findOne({ where: { id: item.questionId } });
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

  async removeQuestionFromQuiz(quizId: string, questionId: string, actorId: string, actorRole: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    if (quiz.status === QuizStatus.ARCHIVED) {
      throw new BadRequestException('Không thể xóa câu hỏi khỏi quiz đã được lưu trữ');
    }

    if (actorRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(actorId, quiz.courseId);
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

  // ==================== ATTEMPT: START QUIZ ====================

  async startQuiz(quizId: string, studentId: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    // 1. Quiz phải đang OPEN
    if (quiz.status !== QuizStatus.OPEN) {
      throw new BadRequestException('Quiz này hiện không mở để làm bài');
    }

    // 2. Học viên phải đang ghi danh vào khóa học
    await this.assertStudentEnrolled(studentId, quiz.courseId);

    // 3. Kiểm tra số lần làm đã dùng
    const attemptCount = await this.quizAttemptRepository.count({
      where: { quizId, studentId },
    });
    if (attemptCount >= quiz.maxAttempts) {
      throw new BadRequestException(
        `Bạn đã sử dụng hết ${quiz.maxAttempts} lần làm bài cho quiz này`,
      );
    }

    // 4. Kiểm tra có lượt làm chưa nộp không (chưa submit)
    const pendingAttempt = await this.quizAttemptRepository.findOne({
      where: { quizId, studentId, submittedAt: IsNull() },
    });
    if (pendingAttempt) {
      // Nếu quiz có giới hạn thời gian (durationMinutes), kiểm tra xem lượt làm dở này có bị quá giờ không
      if (quiz.durationMinutes !== null && quiz.durationMinutes > 0) {
        const now = new Date();
        const startedAtMs = new Date(pendingAttempt.startedAt).getTime();
        const durationMs = quiz.durationMinutes * 60 * 1000;
        const graceMs = 60 * 1000; // 60s gia hạn mạng

        if (now.getTime() - startedAtMs > durationMs + graceMs) {
          // Lượt làm dở đã quá thời gian quy định -> Tự động nộp/đóng lượt làm bài này
          pendingAttempt.submittedAt = new Date(startedAtMs + durationMs);
          pendingAttempt.totalScore = 0;
          await this.quizAttemptRepository.save(pendingAttempt);

          // Dọn dẹp Redis
          await this.redis.del(`quiz:timer:${pendingAttempt.id}`);
          await this.redis.del(`quiz:active:${quizId}:${studentId}`);

          // Kiểm tra lại tổng số lần làm bài sau khi tự động nộp lượt quá hạn
          const updatedAttemptCount = await this.quizAttemptRepository.count({
            where: { quizId, studentId },
          });

          if (updatedAttemptCount >= quiz.maxAttempts) {
            throw new BadRequestException(
              `Lượt làm bài trước đó của bạn đã hết thời gian quy định. Bạn đã sử dụng hết ${quiz.maxAttempts} lần làm bài cho bài kiểm tra này.`,
            );
          }
          // Nếu còn lượt làm bài -> Chạy tiếp xuống dưới để tạo lượt mới!
        } else {
          // Vẫn trong thời gian làm bài hợp lệ -> Cho tiếp tục
          const questions = await this.buildQuizQuestionsForStudent(quizId, quiz.shuffleQuestions);
          return {
            success: true,
            message: 'Bạn đang có lượt làm dở. Tiếp tục làm bài.',
            data: {
              attemptId: pendingAttempt.id,
              attemptNo: pendingAttempt.attemptNo,
              startedAt: pendingAttempt.startedAt,
              durationMinutes: quiz.durationMinutes,
              questions,
            },
          };
        }
      } else {
        // Quiz không giới hạn thời gian -> Trả về lượt làm dở
        const questions = await this.buildQuizQuestionsForStudent(quizId, quiz.shuffleQuestions);
        return {
          success: true,
          message: 'Bạn đang có lượt làm dở. Tiếp tục làm bài.',
          data: {
            attemptId: pendingAttempt.id,
            attemptNo: pendingAttempt.attemptNo,
            startedAt: pendingAttempt.startedAt,
            durationMinutes: quiz.durationMinutes,
            questions,
          },
        };
      }
    }

    // 5. Tạo lượt làm mới
    const newAttempt = this.quizAttemptRepository.create({
      quizId,
      studentId,
      attemptNo: attemptCount + 1,
      startedAt: new Date(),
      submittedAt: null,
      totalScore: null,
    });
    const savedAttempt = await this.quizAttemptRepository.save(newAttempt);

    // --- REDIS ANTI-CHEAT: Lưu Session & Timer ---
    if (quiz.durationMinutes !== null && quiz.durationMinutes > 0) {
      const ttlSeconds = quiz.durationMinutes * 60 + 60; // 60s grace period
      await this.redis.setex(`quiz:timer:${savedAttempt.id}`, ttlSeconds, studentId);
      // Khóa phiên làm bài
      await this.redis.setex(`quiz:active:${quiz.id}:${studentId}`, ttlSeconds, savedAttempt.id);
    }
    // ---------------------------------------------

    // 6. Lấy đề (trả câu hỏi, ẩn isCorrect)
    const questions = await this.buildQuizQuestionsForStudent(quizId, quiz.shuffleQuestions);

    return {
      success: true,
      message: 'Bắt đầu làm quiz thành công',
      data: {
        attemptId: savedAttempt.id,
        attemptNo: savedAttempt.attemptNo,
        startedAt: savedAttempt.startedAt,
        durationMinutes: quiz.durationMinutes,
        questions,
      },
    };
  }

  /** Lấy danh sách câu hỏi cho học viên (ẩn isCorrect, xáo trộn nếu cần) */
  private async buildQuizQuestionsForStudent(quizId: string, shuffle: boolean) {
    const quizQuestions = await this.quizQuestionRepository.find({
      where: { quizId },
      relations: { question: { options: true } },
      order: { orderIndex: 'ASC' },
    });

    let list = quizQuestions.map((qq) => ({
      questionId: qq.questionId,
      orderIndex: qq.orderIndex,
      score: qq.score,
      content: qq.question?.content,
      questionType: qq.question?.questionType,
      difficulty: qq.question?.difficulty,
      options: (qq.question?.options ?? []).map((opt) => ({
        id: opt.id,
        content: opt.content,
        orderIndex: opt.orderIndex,
        // isCorrect bị ẩn hoàn toàn
      })),
    }));

    if (shuffle) {
      list = list.sort(() => Math.random() - 0.5);
    }

    return list;
  }

  // ==================== ATTEMPT: SUBMIT QUIZ ====================

  async submitQuiz(quizId: string, attemptId: string, studentId: string, dto: SubmitQuizDto) {
    // 1. Lấy quiz
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    // 2. Lấy attempt và kiểm tra quyền sở hữu
    const attempt = await this.quizAttemptRepository.findOne({
      where: { id: attemptId, quizId },
    });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }
    if (attempt.studentId !== studentId) {
      throw new ForbiddenException('Bạn không có quyền nộp bài cho lượt làm này');
    }

    // 3. Kiểm tra đã nộp chưa
    if (attempt.submittedAt !== null) {
      throw new BadRequestException('Lượt làm bài này đã được nộp trước đó');
    }

    // 4. Kiểm tra timeout (nếu quiz có giới hạn thời gian)
    if (quiz.durationMinutes !== null && quiz.durationMinutes > 0) {
      const redisTimerStudent = await this.redis.get(`quiz:timer:${attemptId}`);
      if (!redisTimerStudent) {
        throw new BadRequestException(
          `Đã quá thời gian làm bài (${quiz.durationMinutes} phút). Hệ thống đã khóa quyền nộp bài của bạn.`,
        );
      }
      if (redisTimerStudent !== studentId) {
        throw new ForbiddenException('Lỗi xác thực, phiên làm bài không khớp với tài khoản.');
      }
    }

    // 5. Lấy tất cả câu hỏi của quiz kèm đáp án đúng
    const quizQuestions = await this.quizQuestionRepository.find({
      where: { quizId },
      relations: { question: { options: true } },
    });

    // Map: questionId → { scorePerQ, correctOptionIds }
    const questionMap = new Map<string, { score: number; correctOptionIds: Set<string> }>();
    for (const qq of quizQuestions) {
      const correctIds = new Set(
        (qq.question?.options ?? [])
          .filter((o) => o.isCorrect)
          .map((o) => o.id),
      );
      questionMap.set(qq.questionId, { score: qq.score ?? 1, correctOptionIds: correctIds });
    }

    // 6. Chấm điểm từng câu trả lời và lưu QuizAnswer
    let totalScore = 0;
    const savedAnswers: QuizAnswer[] = [];

    for (const ans of dto.answers) {
      const qInfo = questionMap.get(ans.questionId);
      if (!qInfo) continue; // câu hỏi không thuộc quiz → bỏ qua

      const selectedIds = new Set(ans.answerData);
      const isCorrect =
        selectedIds.size === qInfo.correctOptionIds.size &&
        [...selectedIds].every((id) => qInfo.correctOptionIds.has(id));

      const earnedScore = isCorrect ? qInfo.score : 0;
      totalScore += earnedScore;

      const quizAnswer = this.quizAnswerRepository.create({
        attemptId,
        questionId: ans.questionId,
        answerData: ans.answerData,
        isCorrect,
        score: earnedScore,
      });
      const saved = await this.quizAnswerRepository.save(quizAnswer);
      savedAnswers.push(saved);
    }

    // 7. Cập nhật attempt
    attempt.submittedAt = new Date();
    attempt.totalScore = totalScore;
    await this.quizAttemptRepository.save(attempt);

    // --- REDIS ANTI-CHEAT: Dọn dẹp Session & Timer ---
    await this.redis.del(`quiz:timer:${attemptId}`);
    await this.redis.del(`quiz:active:${quizId}:${studentId}`);

    return {
      success: true,
      message: 'Nộp bài thành công',
      data: {
        attemptId,
        attemptNo: attempt.attemptNo,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        totalScore,
        maxPossibleScore: [...questionMap.values()].reduce((s, q) => s + q.score, 0),
        answers: savedAnswers.map((a) => ({
          questionId: a.questionId,
          answerData: a.answerData,
          isCorrect: a.isCorrect,
          score: a.score,
        })),
      },
    };
  }

  // ==================== ATTEMPT HISTORY ====================

  async getAttemptHistory(quizId: string, requesterId: string, requesterRole: string, targetStudentId?: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    let studentId: string;

    if (requesterRole === UserRole.STUDENT) {
      // Học viên chỉ xem lịch sử của chính mình
      studentId = requesterId;
      await this.assertStudentEnrolled(requesterId, quiz.courseId);
    } else {
      // Admin / Lecturer xem của học viên cụ thể (bắt buộc truyền studentId)
      if (!targetStudentId) {
        throw new BadRequestException('Vui lòng cung cấp studentId để xem lịch sử làm bài');
      }
      if (requesterRole === UserRole.LECTURER) {
        await this.assertLecturerOwnsQuizCourse(requesterId, quiz.courseId);
      }
      studentId = targetStudentId;
    }

    const attempts = await this.quizAttemptRepository.find({
      where: { quizId, studentId },
      order: { attemptNo: 'ASC' },
    });

    return {
      success: true,
      data: {
        quizId,
        quizTitle: quiz.title,
        maxAttempts: quiz.maxAttempts,
        attemptsUsed: attempts.length,
        attempts: attempts.map((a) => {
          let isExpired = false;
          if (!a.submittedAt && quiz.durationMinutes && quiz.durationMinutes > 0) {
            const startedAtMs = new Date(a.startedAt).getTime();
            const durationMs = quiz.durationMinutes * 60 * 1000;
            if (Date.now() - startedAtMs > durationMs + 60000) {
              isExpired = true;
            }
          }
          return {
            attemptId: a.id,
            attemptNo: a.attemptNo,
            startedAt: a.startedAt,
            submittedAt: a.submittedAt,
            totalScore: a.totalScore,
            status: a.submittedAt ? 'submitted' : (isExpired ? 'expired' : 'in_progress'),
          };
        }),
      },
    };
  }

  async getAttemptDetail(quizId: string, attemptId: string, requesterId: string, requesterRole: string) {
    const quiz = await this.quizRepository.findOne({ where: { id: quizId } });
    if (!quiz) {
      throw new NotFoundException('Không tìm thấy quiz');
    }

    const attempt = await this.quizAttemptRepository.findOne({
      where: { id: attemptId, quizId },
    });
    if (!attempt) {
      throw new NotFoundException('Không tìm thấy lượt làm bài');
    }

    // Học viên chỉ xem lịch sử của chính mình
    if (requesterRole === UserRole.STUDENT && attempt.studentId !== requesterId) {
      throw new ForbiddenException('Bạn không có quyền xem lượt làm bài này');
    }
    if (requesterRole === UserRole.LECTURER) {
      await this.assertLecturerOwnsQuizCourse(requesterId, quiz.courseId);
    }

    const answers = await this.quizAnswerRepository.find({
      where: { attemptId },
      relations: { question: { options: true } },
    });

    return {
      success: true,
      data: {
        attemptId: attempt.id,
        attemptNo: attempt.attemptNo,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        totalScore: attempt.totalScore,
        answers: answers.map((a) => ({
          questionId: a.questionId,
          content: a.question?.content,
          questionType: a.question?.questionType,
          answerData: a.answerData,
          isCorrect: a.isCorrect,
          score: a.score,
          options: (a.question?.options ?? []).map((opt) => ({
            id: opt.id,
            content: opt.content,
            isCorrect: opt.isCorrect,
            orderIndex: opt.orderIndex,
          })),
        })),
      },
    };
  }
}
