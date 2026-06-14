import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Course } from '../models/Course.entity';
import { Class } from '../models/Class.entity';
import { Enrollment, EnrollmentStatus } from '../models/Enrollment.entity';
import { TeachingAssignment } from '../models/TeachingAssignment.entity';
import { ClassTransferHistory } from '../models/ClassTransferHistory.entity';
import { User, UserRole, UserStatus } from '../../users/models/User.entity';
import { CreateCourseDto, UpdateCourseDto } from '../dto/course.dto';
import { CreateClassDto, UpdateClassDto, AssignLecturerDto, EnrollStudentDto, TransferStudentDto } from '../dto/class.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Class)
    private readonly classRepository: Repository<Class>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepository: Repository<Enrollment>,
    @InjectRepository(TeachingAssignment)
    private readonly teachingAssignmentRepository: Repository<TeachingAssignment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ClassTransferHistory)
    private readonly classTransferHistoryRepository: Repository<ClassTransferHistory>,
    private readonly dataSource: DataSource,
  ) {}

  // ==================== COURSE CRUD ====================

  async createCourse(dto: CreateCourseDto, creatorId?: string) {
    // Check if code is already in use
    const existing = await this.courseRepository.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException('Mã khóa học này đã tồn tại trên hệ thống');
    }

    const course = this.courseRepository.create({
      ...dto,
      createdBy: creatorId,
      updatedBy: creatorId,
    });

    const saved = await this.courseRepository.save(course);
    return {
      success: true,
      message: 'Tạo khóa học thành công',
      data: saved,
    };
  }

  async findAllCourses(search?: string, status?: string) {
    const query = this.courseRepository.createQueryBuilder('course');

    if (search) {
      query.andWhere(
        '(course.name ILIKE :search OR course.code ILIKE :search OR course.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      query.andWhere('course.status = :status', { status });
    }

    query.orderBy('course.createdAt', 'DESC');
    const courses = await query.getMany();

    return {
      success: true,
      data: courses,
    };
  }

  async findCourseById(id: string) {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: { classes: true },
    });

    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học');
    }

    return {
      success: true,
      data: course,
    };
  }

  async updateCourse(id: string, dto: UpdateCourseDto, updaterId?: string) {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học');
    }

    if (dto.code && dto.code !== course.code) {
      const existing = await this.courseRepository.findOne({ where: { code: dto.code } });
      if (existing) {
        throw new BadRequestException('Mã khóa học này đã tồn tại trên hệ thống');
      }
    }

    Object.assign(course, {
      ...dto,
      updatedBy: updaterId,
    });

    const updated = await this.courseRepository.save(course);
    return {
      success: true,
      message: 'Cập nhật khóa học thành công',
      data: updated,
    };
  }

  async removeCourse(id: string) {
    const course = await this.courseRepository.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học');
    }

    // Soft delete
    await this.courseRepository.softRemove(course);
    return {
      success: true,
      message: 'Xóa khóa học thành công',
    };
  }

  // ==================== CLASS CRUD ====================

  async createClass(courseId: string, dto: CreateClassDto, creatorId?: string) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học tương ứng');
    }

    const newClass = this.classRepository.create({
      ...dto,
      courseId,
      createdBy: creatorId,
      updatedBy: creatorId,
    });

    const saved = await this.classRepository.save(newClass);
    return {
      success: true,
      message: 'Tạo lớp học thành công',
      data: saved,
    };
  }

  async findClassesByCourse(courseId: string) {
    const course = await this.courseRepository.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Không tìm thấy khóa học tương ứng');
    }

    const classes = await this.classRepository.find({
      where: { courseId },
      order: { createdAt: 'ASC' },
    });

    return {
      success: true,
      data: classes,
    };
  }

  async findClassById(id: string) {
    const cls = await this.classRepository.findOne({
      where: { id },
      relations: { course: true },
    });

    if (!cls) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    return {
      success: true,
      data: cls,
    };
  }

  async updateClass(id: string, dto: UpdateClassDto, updaterId?: string) {
    const cls = await this.classRepository.findOne({ where: { id } });
    if (!cls) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    Object.assign(cls, {
      ...dto,
      updatedBy: updaterId,
    });

    const updated = await this.classRepository.save(cls);
    return {
      success: true,
      message: 'Cập nhật lớp học thành công',
      data: updated,
    };
  }

  async removeClass(id: string) {
    const cls = await this.classRepository.findOne({ where: { id } });
    if (!cls) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    await this.classRepository.softRemove(cls);
    return {
      success: true,
      message: 'Xóa lớp học thành công',
    };
  }

  // ==================== LECTURER ASSIGNMENT ====================

  async assignLecturer(classId: string, dto: AssignLecturerDto) {
    const cls = await this.classRepository.findOne({ where: { id: classId } });
    if (!cls) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    // Validate lecturer existence and role
    const lecturer = await this.userRepository.findOne({
      where: { id: dto.lecturerId, role: UserRole.LECTURER },
    });
    if (!lecturer) {
      throw new BadRequestException('ID người dùng không phải là Giảng viên hoặc không tồn tại');
    }

    if (lecturer.status === UserStatus.LOCKED) {
      throw new BadRequestException('Tài khoản giảng viên này hiện đang bị khóa');
    }

    // Upsert assignment
    let assignment = await this.teachingAssignmentRepository.findOne({
      where: { classId, lecturerId: dto.lecturerId },
    });

    if (assignment) {
      assignment.role = dto.role;
    } else {
      assignment = this.teachingAssignmentRepository.create({
        classId,
        lecturerId: dto.lecturerId,
        courseId: cls.courseId,
        role: dto.role,
      });
    }

    const saved = await this.teachingAssignmentRepository.save(assignment);
    return {
      success: true,
      message: 'Phân công giảng viên thành công',
      data: saved,
    };
  }

  async removeLecturer(classId: string, lecturerId: string) {
    const assignment = await this.teachingAssignmentRepository.findOne({
      where: { classId, lecturerId },
    });

    if (!assignment) {
      throw new NotFoundException('Không tìm thấy thông tin phân công giảng dạy tương ứng');
    }

    await this.teachingAssignmentRepository.remove(assignment);
    return {
      success: true,
      message: 'Hủy phân công giảng viên thành công',
    };
  }

  async findLecturersByClass(classId: string) {
    const assignments = await this.teachingAssignmentRepository.find({
      where: { classId },
      relations: { lecturer: true },
    });

    return {
      success: true,
      data: assignments.map((asm) => ({
        lecturerId: asm.lecturerId,
        fullName: asm.lecturer.fullName,
        email: asm.lecturer.email,
        phone: asm.lecturer.phone,
        role: asm.role,
        assignedAt: asm.assignedAt,
      })),
    };
  }

  // ==================== STUDENT ENROLLMENT ====================

  async enrollStudent(classId: string, dto: EnrollStudentDto) {
    // Perform operations in a single Database Transaction for reliability (NFR-04)
    return await this.dataSource.transaction(async (manager) => {
      // 1. Get and Lock Class record for capacity check
      const cls = await manager.findOne(Class, {
        where: { id: classId },
      });
      if (!cls) {
        throw new NotFoundException('Không tìm thấy lớp học');
      }

      // 2. Validate Student existence
      const student = await manager.findOne(User, {
        where: { id: dto.studentId, role: UserRole.STUDENT },
      });
      if (!student) {
        throw new BadRequestException('ID người dùng không phải là Học viên hoặc không tồn tại');
      }

      if (student.status === UserStatus.LOCKED) {
        throw new BadRequestException('Tài khoản học viên này hiện đang bị khóa');
      }

      // 3. Check Capacity
      if (cls.maxStudents !== null && cls.maxStudents !== undefined) {
        const currentActiveCount = await manager.count(Enrollment, {
          where: { classId, status: EnrollmentStatus.ACTIVE },
        });

        if (currentActiveCount >= cls.maxStudents) {
          throw new BadRequestException('Lớp học đã đạt sĩ số tối đa, không thể gán thêm học viên');
        }
      }

      // 4. Check if student already has an active enrollment in the same course
      const activeEnrollment = await manager.findOne(Enrollment, {
        where: {
          studentId: dto.studentId,
          courseId: cls.courseId,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      if (activeEnrollment) {
        const alreadyInClass = await manager.findOne(Class, { where: { id: activeEnrollment.classId } });
        throw new BadRequestException(
          `Học viên này đang tham gia lớp học hoạt động khác (${alreadyInClass?.name || activeEnrollment.classId}) trong cùng một khóa học`,
        );
      }

      // 5. Check if enrollment record already exists (e.g. was cancelled or completed previously, we can reactivate or create new)
      let enrollment = await manager.findOne(Enrollment, {
        where: { studentId: dto.studentId, courseId: cls.courseId, classId },
      });

      if (enrollment) {
        enrollment.status = EnrollmentStatus.ACTIVE;
        enrollment.enrolledAt = new Date();
      } else {
        enrollment = manager.create(Enrollment, {
          studentId: dto.studentId,
          courseId: cls.courseId,
          classId,
          status: EnrollmentStatus.ACTIVE,
        });
      }

      const saved = await manager.save(Enrollment, enrollment);
      return {
        success: true,
        message: 'Ghi danh học viên vào lớp thành công',
        data: saved,
      };
    });
  }

  async removeStudent(classId: string, studentId: string) {
    const enrollment = await this.enrollmentRepository.findOne({
      where: { classId, studentId },
    });

    if (!enrollment) {
      throw new NotFoundException('Học viên không có thông tin ghi danh trong lớp học này');
    }

    // Instead of completely deleting, we can either hard delete or switch status to CANCELLED.
    // The user requested: "gán khi đổi/xóa thì làm bình thường". We'll remove it.
    await this.enrollmentRepository.remove(enrollment);
    return {
      success: true,
      message: 'Xóa học viên khỏi lớp thành công',
    };
  }

  async findStudentsByClass(classId: string) {
    const enrollments = await this.enrollmentRepository.find({
      where: { classId },
      relations: { student: true },
      order: { enrolledAt: 'DESC' },
    });

    return {
      success: true,
      data: enrollments.map((enr) => ({
        studentId: enr.studentId,
        fullName: enr.student.fullName,
        email: enr.student.email,
        phone: enr.student.phone,
        status: enr.status,
        enrolledAt: enr.enrolledAt,
        completedPercent: enr.completedPercent,
      })),
    };
  }

  // ==================== CLASS TRANSFER & HISTORY ====================

  async transferStudent(dto: TransferStudentDto, adminId: string) {
    return await this.dataSource.transaction(async (manager) => {
      // 1. Validate student existence and role
      const student = await manager.findOne(User, {
        where: { id: dto.studentId, role: UserRole.STUDENT },
      });
      if (!student) {
        throw new BadRequestException('ID người dùng không phải là Học viên hoặc không tồn tại');
      }

      if (student.status === UserStatus.LOCKED) {
        throw new BadRequestException('Tài khoản học viên này hiện đang bị khóa');
      }

      // 2. Validate fromClass and toClass existence
      const fromClass = await manager.findOne(Class, {
        where: { id: dto.fromClassId },
      });
      if (!fromClass) {
        throw new NotFoundException('Không tìm thấy lớp học nguồn');
      }

      const toClass = await manager.findOne(Class, {
        where: { id: dto.toClassId },
      });
      if (!toClass) {
        throw new NotFoundException('Không tìm thấy lớp học đích');
      }

      // 3. Ensure both classes belong to the same course
      if (fromClass.courseId !== toClass.courseId) {
        throw new BadRequestException('Hai lớp học này không thuộc cùng một khóa học');
      }

      if (dto.fromClassId === dto.toClassId) {
        throw new BadRequestException('Lớp học nguồn và lớp học đích không được trùng nhau');
      }

      // 4. Validate current active enrollment in fromClass
      const currentEnrollment = await manager.findOne(Enrollment, {
        where: {
          studentId: dto.studentId,
          courseId: fromClass.courseId,
          classId: dto.fromClassId,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      if (!currentEnrollment) {
        throw new BadRequestException('Học viên không có thông tin ghi danh hoạt động ở lớp học nguồn');
      }

      // 5. Check if student already has an active enrollment in toClass
      const targetActiveEnrollment = await manager.findOne(Enrollment, {
        where: {
          studentId: dto.studentId,
          courseId: fromClass.courseId,
          classId: dto.toClassId,
          status: EnrollmentStatus.ACTIVE,
        },
      });
      if (targetActiveEnrollment) {
        throw new BadRequestException('Học viên đã hoạt động trong lớp học đích rồi');
      }

      // 6. Check capacity of toClass
      if (toClass.maxStudents !== null && toClass.maxStudents !== undefined) {
        const currentActiveCount = await manager.count(Enrollment, {
          where: { classId: dto.toClassId, status: EnrollmentStatus.ACTIVE },
        });

        if (currentActiveCount >= toClass.maxStudents) {
          throw new BadRequestException('Lớp học đích đã đạt sĩ số tối đa, không thể điều chuyển thêm học viên');
        }
      }

      // 7. Update old enrollment to TRANSFERRED
      currentEnrollment.status = EnrollmentStatus.TRANSFERRED;
      await manager.save(Enrollment, currentEnrollment);

      // 8. Create or update new enrollment to ACTIVE, copy completedPercent
      let newEnrollment = await manager.findOne(Enrollment, {
        where: {
          studentId: dto.studentId,
          courseId: fromClass.courseId,
          classId: dto.toClassId,
        },
      });

      if (newEnrollment) {
        newEnrollment.status = EnrollmentStatus.ACTIVE;
        newEnrollment.enrolledAt = new Date();
        newEnrollment.completedPercent = currentEnrollment.completedPercent;
      } else {
        newEnrollment = manager.create(Enrollment, {
          studentId: dto.studentId,
          courseId: fromClass.courseId,
          classId: dto.toClassId,
          status: EnrollmentStatus.ACTIVE,
          completedPercent: currentEnrollment.completedPercent,
        });
      }
      await manager.save(Enrollment, newEnrollment);

      // 9. Save transfer history
      const history = manager.create(ClassTransferHistory, {
        studentId: dto.studentId,
        courseId: fromClass.courseId,
        fromClassId: dto.fromClassId,
        toClassId: dto.toClassId,
        reason: dto.reason || null,
        transferredBy: adminId,
      });
      await manager.save(ClassTransferHistory, history);

      return {
        success: true,
        message: 'Điều chuyển lớp học viên thành công',
        data: history,
      };
    });
  }

  async findTransferHistories(query: {
    studentId?: string;
    courseId?: string;
    fromClassId?: string;
    toClassId?: string;
  }) {
    const qb = this.classTransferHistoryRepository
      .createQueryBuilder('history')
      .leftJoinAndSelect('history.student', 'student')
      .leftJoinAndSelect('history.course', 'course')
      .leftJoinAndSelect('history.fromClass', 'fromClass')
      .leftJoinAndSelect('history.toClass', 'toClass')
      .leftJoinAndSelect('history.transferredByUser', 'admin');

    if (query.studentId) {
      qb.andWhere('history.studentId = :studentId', { studentId: query.studentId });
    }
    if (query.courseId) {
      qb.andWhere('history.courseId = :courseId', { courseId: query.courseId });
    }
    if (query.fromClassId) {
      qb.andWhere('history.fromClassId = :fromClassId', { fromClassId: query.fromClassId });
    }
    if (query.toClassId) {
      qb.andWhere('history.toClassId = :toClassId', { toClassId: query.toClassId });
    }

    qb.orderBy('history.transferredAt', 'DESC');
    const list = await qb.getMany();

    return {
      success: true,
      data: list.map((item) => ({
        id: item.id,
        student: {
          id: item.student?.id,
          fullName: item.student?.fullName,
          email: item.student?.email,
        },
        course: {
          id: item.course?.id,
          code: item.course?.code,
          name: item.course?.name,
        },
        fromClass: {
          id: item.fromClass?.id,
          name: item.fromClass?.name,
        },
        toClass: {
          id: item.toClass?.id,
          name: item.toClass?.name,
        },
        reason: item.reason,
        transferredBy: {
          id: item.transferredByUser?.id,
          fullName: item.transferredByUser?.fullName,
        },
        transferredAt: item.transferredAt,
      })),
    };
  }
}
