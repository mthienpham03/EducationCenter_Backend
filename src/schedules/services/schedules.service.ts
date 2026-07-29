import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule, ScheduleStatus } from '../models/Schedule.entity';
import { User, UserRole, UserStatus } from '../../users/models/User.entity';
import { Course } from '../../courses/models/Course.entity';
import { Class } from '../../courses/models/Class.entity';
import { CreateScheduleDto, UpdateScheduleDto } from '../dto/schedule.dto';

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

    await this.scheduleRepository.softRemove(schedule);
    
    return {
      success: true,
      message: 'Xóa lịch dạy thành công',
    };
  }
}
