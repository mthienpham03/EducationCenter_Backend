import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Schedule, ScheduleStatus } from '../models/Schedule.entity';
import { User, UserRole, UserStatus } from '../../users/models/User.entity';
import { Course } from '../../courses/models/Course.entity';
import { Class } from '../../courses/models/Class.entity';
import { Lesson, LessonStatus } from '../../curriculum/models/Lesson.entity';
import { Notification, NotificationStatus } from '../../notifications/models/Notification.entity';
import { CreateScheduleDto, UpdateScheduleDto } from '../dto/schedule.dto';
import { AutoGenerateScheduleDto } from '../dto/auto-generate-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly dataSource: DataSource,
  ) {}

  private async validateScheduleOverlap(
    lecturerId: string,
    startTime: Date,
    endTime: Date,
    excludeScheduleId?: string,
  ) {
    if (startTime >= endTime) {
      throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc');
    }

    const query = this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.lecturerId = :lecturerId', { lecturerId })
      .andWhere('schedule.status != :status', { status: ScheduleStatus.CANCELLED })
      .andWhere(
        '(schedule.startTime < :endTime AND schedule.endTime > :startTime)',
        { startTime, endTime },
      );

    if (excludeScheduleId) {
      query.andWhere('schedule.id != :excludeScheduleId', { excludeScheduleId });
    }

    const overlappingSchedule = await query.getOne();

    if (overlappingSchedule) {
      throw new BadRequestException(
        `Giảng viên đã có lịch dạy trùng lặp từ ${overlappingSchedule.startTime.toISOString()} đến ${overlappingSchedule.endTime.toISOString()}`,
      );
    }
  }

  async createSchedule(dto: CreateScheduleDto, creatorId?: string) {
    // 1. Verify lecturer exists and is active
    const lecturer = await this.userRepository.findOne({
      where: { id: dto.lecturerId, role: UserRole.LECTURER },
    });
    if (!lecturer) {
      throw new BadRequestException('Giảng viên không tồn tại hoặc không hợp lệ');
    }
    if (lecturer.status === UserStatus.LOCKED) {
      throw new BadRequestException('Tài khoản giảng viên đang bị khóa');
    }

    // 2. Verify course and class exist
    const course = await this.courseRepository.findOne({ where: { id: dto.courseId } });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }

    const classEntity = await this.classRepository.findOne({ where: { id: dto.classId } });
    if (!classEntity) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    // 3. Logic Check: Overlapping Schedule
    await this.validateScheduleOverlap(dto.lecturerId, startTime, endTime);

    // 4. Create and save Schedule
    const newSchedule = this.scheduleRepository.create({
      ...dto,
      startTime,
      endTime,
      createdBy: creatorId,
      updatedBy: creatorId,
    });

    const saved = await this.scheduleRepository.save(newSchedule);

    return {
      success: true,
      message: 'Tạo lịch dạy thành công',
      data: saved,
    };
  }

  async autoGenerateSchedules(dto: AutoGenerateScheduleDto, creatorId?: string) {
    // 1. Validate inputs
    const lecturer = await this.userRepository.findOne({
      where: { id: dto.lecturerId, role: UserRole.LECTURER },
    });
    if (!lecturer || lecturer.status === UserStatus.LOCKED) {
      throw new BadRequestException('Giảng viên không tồn tại hoặc bị khóa');
    }

    const course = await this.courseRepository.findOne({ where: { id: dto.courseId } });
    if (!course) {
      throw new NotFoundException('Khóa học không tồn tại');
    }

    const classEntity = await this.classRepository.findOne({ where: { id: dto.classId } });
    if (!classEntity) {
      throw new NotFoundException('Lớp học không tồn tại');
    }

    // 2. Fetch and sort lessons
    const lessons = await this.lessonRepository.find({
      where: { chapter: { courseId: dto.courseId } },
      relations: { chapter: true },
      order: {
        chapter: { orderIndex: 'ASC' },
        orderIndex: 'ASC',
      },
    });

    if (!lessons.length) {
      throw new BadRequestException('Khóa học chưa có bài học nào để tạo lịch');
    }

    // 3. Algorithm: Match dates
    const schedulesToCreate: Schedule[] = [];
    let currentDate = new Date(dto.startDate);
    
    // Sort pattern days just in case
    const pattern = dto.schedulePattern;
    if (!pattern || pattern.length === 0) {
      throw new BadRequestException('Mẫu lịch học (schedulePattern) không được để trống');
    }

    for (const lesson of lessons) {
      // Find the next matching day
      let matchFound = false;
      let iterations = 0; // Guard to prevent infinite loop

      while (!matchFound && iterations < 365) { // Max 1 year forward
        const currentDayOfWeek = currentDate.getDay();
        
        const matchedPattern = pattern.find(p => p.dayOfWeek === currentDayOfWeek);
        if (matchedPattern) {
          // Construct start and end dates
          const [startHour, startMinute] = matchedPattern.startTime.split(':').map(Number);
          const [endHour, endMinute] = matchedPattern.endTime.split(':').map(Number);
          
          const startTime = new Date(currentDate);
          startTime.setHours(startHour, startMinute, 0, 0);

          const endTime = new Date(currentDate);
          endTime.setHours(endHour, endMinute, 0, 0);

          if (startTime >= endTime) {
            throw new BadRequestException(`Giờ học ${matchedPattern.startTime} - ${matchedPattern.endTime} không hợp lệ`);
          }

          // Validate Overlap for this specific generated schedule
          await this.validateScheduleOverlap(dto.lecturerId, startTime, endTime);

          const newSchedule = this.scheduleRepository.create({
            courseId: dto.courseId,
            classId: dto.classId,
            lecturerId: dto.lecturerId,
            lessonId: lesson.id,
            startTime,
            endTime,
            room: matchedPattern.room || null,
            status: ScheduleStatus.SCHEDULED,
            createdBy: creatorId,
            updatedBy: creatorId,
          });

          schedulesToCreate.push(newSchedule);
          matchFound = true;
        }

        // Always advance the date after processing (or if not matched)
        currentDate.setDate(currentDate.getDate() + 1);
        iterations++;
      }
      
      if (!matchFound) {
        throw new BadRequestException('Không thể xếp lịch do thuật toán vượt quá 365 ngày');
      }
    }

    // 4. Save using transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedSchedules: Schedule[] = [];
    try {
      savedSchedules = await queryRunner.manager.save(Schedule, schedulesToCreate);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return {
      success: true,
      message: `Đã tự động tạo thành công ${savedSchedules.length} buổi học.`,
      data: savedSchedules,
    };
  }

  async findAllSchedules(
    lecturerId?: string,
    classId?: string,
    courseId?: string,
  ) {
    const query = this.scheduleRepository.createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.course', 'course')
      .leftJoinAndSelect('schedule.scheduleClass', 'class')
      .leftJoinAndSelect('schedule.lecturer', 'lecturer')
      .leftJoinAndSelect('schedule.lesson', 'lesson');

    if (lecturerId) {
      query.andWhere('schedule.lecturerId = :lecturerId', { lecturerId });
    }
    if (classId) {
      query.andWhere('schedule.classId = :classId', { classId });
    }
    if (courseId) {
      query.andWhere('schedule.courseId = :courseId', { courseId });
    }

    query.orderBy('schedule.startTime', 'ASC');
    const schedules = await query.getMany();

    return {
      success: true,
      data: schedules,
    };
  }

  async findScheduleById(id: string) {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: { course: true, scheduleClass: true, lecturer: true, lesson: true },
    });

    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch dạy');
    }

    return {
      success: true,
      data: schedule,
    };
  }

  async updateSchedule(id: string, dto: UpdateScheduleDto, updaterId?: string) {
    const schedule = await this.scheduleRepository.findOne({ where: { id } });
    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch dạy');
    }

    if (dto.lecturerId && dto.lecturerId !== schedule.lecturerId) {
      const lecturer = await this.userRepository.findOne({
        where: { id: dto.lecturerId, role: UserRole.LECTURER },
      });
      if (!lecturer) {
        throw new BadRequestException('Giảng viên không tồn tại hoặc không hợp lệ');
      }
      if (lecturer.status === UserStatus.LOCKED) {
        throw new BadRequestException('Tài khoản giảng viên đang bị khóa');
      }
    }

    const nextStartTime = dto.startTime ? new Date(dto.startTime) : schedule.startTime;
    const nextEndTime = dto.endTime ? new Date(dto.endTime) : schedule.endTime;
    const lecturerToCheck = dto.lecturerId || schedule.lecturerId;

    // Logic Check: Overlapping Schedule (exclude this schedule ID)
    if (
      dto.startTime ||
      dto.endTime ||
      dto.lecturerId ||
      dto.status === ScheduleStatus.RESCHEDULED ||
      schedule.status !== ScheduleStatus.CANCELLED
    ) {
      // only check if not cancelling
      if (dto.status !== ScheduleStatus.CANCELLED) {
        await this.validateScheduleOverlap(
          lecturerToCheck,
          nextStartTime,
          nextEndTime,
          id,
        );
      }
    }

    Object.assign(schedule, {
      ...dto,
      startTime: nextStartTime,
      endTime: nextEndTime,
      updatedBy: updaterId,
    });

    const updated = await this.scheduleRepository.save(schedule);

    // Xử lý Hủy / Dời lịch / Khẩn cấp
    const isCancelledOrRescheduled =
      dto.status === ScheduleStatus.CANCELLED ||
      dto.status === ScheduleStatus.RESCHEDULED;

    if (isCancelledOrRescheduled || dto.isEmergency) {
      const isCancel = dto.status === ScheduleStatus.CANCELLED;
      const titlePrefix = dto.isEmergency ? '[KHẨN CẤP] ' : '';
      const actionTitle = isCancel ? 'Hủy lịch học' : 'Dời lịch học';
      
      const title = `${titlePrefix}Thông báo ${actionTitle}`;
      const reasonText = dto.reason ? ` Lý do: ${dto.reason}` : '';
      const content = `Lịch học lúc ${schedule.startTime.toISOString()} đã bị ${isCancel ? 'hủy' : 'dời'}.${reasonText}`;

      // Gửi cho Giảng viên (Lecturer)
      if (schedule.lecturerId) {
        await this.notificationRepository.save(
          this.notificationRepository.create({
            title,
            content,
            targetType: 'user',
            targetId: schedule.lecturerId,
            status: NotificationStatus.UNREAD,
          }),
        );
      }

      // Gửi cho cả Lớp (Class)
      if (schedule.classId) {
        await this.notificationRepository.save(
          this.notificationRepository.create({
            title,
            content,
            targetType: 'class',
            targetId: schedule.classId,
            status: NotificationStatus.UNREAD,
          }),
        );
      }
    }

    return {
      success: true,
      message: 'Cập nhật lịch dạy thành công',
      data: updated,
    };
  }

  async removeSchedule(id: string) {
    const schedule = await this.scheduleRepository.findOne({ where: { id } });
    if (!schedule) {
      throw new NotFoundException('Không tìm thấy lịch dạy');
    }

    // Đổi status thành CANCELLED trước khi softRemove
    schedule.status = ScheduleStatus.CANCELLED;
    schedule.reason = 'Hủy lịch học từ Admin';
    schedule.isEmergency = true;
    await this.scheduleRepository.save(schedule);

    // Gửi thông báo khẩn cấp cho giảng viên và lớp
    const title = '[KHẨN CẤP] Hủy lịch học';
    const content = `Lịch học lúc ${schedule.startTime.toISOString()} đã bị hủy bởi Quản trị viên.`;

    if (schedule.lecturerId) {
      await this.notificationRepository.save(
        this.notificationRepository.create({
          title,
          content,
          targetType: 'user',
          targetId: schedule.lecturerId,
        }),
      );
    }
    if (schedule.classId) {
      await this.notificationRepository.save(
        this.notificationRepository.create({
          title,
          content,
          targetType: 'class',
          targetId: schedule.classId,
        }),
      );
    }

    await this.scheduleRepository.softRemove(schedule);
    
    return {
      success: true,
      message: 'Xóa lịch dạy thành công',
    };
  }
}
