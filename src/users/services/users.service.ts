import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Inject,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '../models/User.entity';
import { LecturerProfile } from '../../lecturers/models/LecturerProfile.entity';
import { StudentProfile } from '../../students/models/StudentProfile.entity';
import { CreateLecturerDto, CreateStudentDto } from '../dto/create-user.dto';
import { LockUserDto } from '../dto/lock-user.dto';
import { UpdateLecturerDto, UpdateStudentDto } from '../dto/update-user.dto';
import { MailService } from '../../utils/mail/services/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import * as XLSX from 'xlsx';
import { CloudinaryService } from '../../utils/cloudinary/services/cloudinary.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { Specialization } from '../../specializations/models/Specialization.entity';

@Injectable()
export class UsersService {
  constructor(
    private dataSource: DataSource,
    private mailService: MailService,
    @Inject('REDIS_CLIENT') private redisClient: Redis,
    private cloudinaryService: CloudinaryService,
  ) {}

  private generateRandomPassword(length = 8): string {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  async createLecturer(createLecturerDto: CreateLecturerDto) {
    const { email, fullName, phone, specializationIds, experienceYears, avatarUrl } =
      createLecturerDto;

    // Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userRepository = queryRunner.manager.getRepository(User);
      const lecturerProfileRepository =
        queryRunner.manager.getRepository(LecturerProfile);

      // Check if user exists
      const existingUser = await userRepository.findOne({ where: { email } });
      if (existingUser) {
        throw new BadRequestException('Email này đã tồn tại trong hệ thống');
      }

      // Generate and hash password
      const plainPassword = this.generateRandomPassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      // Create User
      const user = userRepository.create({
        email,
        passwordHash,
        fullName,
        phone,
        avatarUrl,
        role: UserRole.LECTURER,
        status: UserStatus.ACTIVE,
      });
      const savedUser = await userRepository.save(user);

      // Fetch specializations
      let specializations: Specialization[] = [];
      if (specializationIds && specializationIds.length > 0) {
        const specializationRepository = queryRunner.manager.getRepository(Specialization);
        specializations = await specializationRepository.createQueryBuilder('s')
          .where('s.id IN (:...ids)', { ids: specializationIds })
          .getMany();
      }

      // Create LecturerProfile
      const lecturerProfile = lecturerProfileRepository.create({
        userId: savedUser.id,
        specializations,
        experienceYears,
      });
      await lecturerProfileRepository.save(lecturerProfile);

      await queryRunner.commitTransaction();

      // Send Email in background (do not await to block response)
      this.mailService
        .sendAccountCreatedEmail(
          email,
          fullName,
          plainPassword,
          UserRole.LECTURER,
        )
        .catch((e) => console.error(e));

      // Exclude password from response
      const result = { ...savedUser } as Omit<User, 'passwordHash'> & {
        passwordHash?: string;
      };
      delete result.passwordHash;
      return {
        success: true,
        message: 'Tạo tài khoản Giảng viên thành công',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) throw error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Có lỗi xảy ra khi tạo tài khoản giảng viên: ' + errorMessage,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async createStudent(createStudentDto: CreateStudentDto) {
    const { email, fullName, phone, studentCode, dateOfBirth, address } =
      createStudentDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userRepository = queryRunner.manager.getRepository(User);
      const studentProfileRepository =
        queryRunner.manager.getRepository(StudentProfile);

      const existingUser = await userRepository.findOne({ where: { email } });
      if (existingUser) {
        throw new BadRequestException('Email này đã tồn tại trong hệ thống');
      }

      const existingStudentCode = await studentProfileRepository.findOne({
        where: { studentCode },
      });
      if (existingStudentCode) {
        throw new BadRequestException('Mã học viên này đã tồn tại');
      }

      const plainPassword = this.generateRandomPassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      const user = userRepository.create({
        email,
        passwordHash,
        fullName,
        phone,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
      });
      const savedUser = await userRepository.save(user);

      const studentProfile = studentProfileRepository.create({
        userId: savedUser.id,
        studentCode,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address,
      });
      await studentProfileRepository.save(studentProfile);

      await queryRunner.commitTransaction();

      this.mailService
        .sendAccountCreatedEmail(
          email,
          fullName,
          plainPassword,
          UserRole.STUDENT,
        )
        .catch((e) => console.error(e));

      const result = { ...savedUser } as Omit<User, 'passwordHash'> & {
        passwordHash?: string;
      };
      delete result.passwordHash;
      return {
        success: true,
        message: 'Tạo tài khoản Học viên thành công',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) throw error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Có lỗi xảy ra khi tạo tài khoản học viên: ' + errorMessage,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(search?: string, role?: UserRole, status?: UserStatus) {
    const userRepository = this.dataSource.getRepository(User);
    const queryBuilder = userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.lecturerProfile', 'lecturerProfile')
      .leftJoinAndSelect('lecturerProfile.specializations', 'specializations')
      .leftJoinAndSelect('user.studentProfile', 'studentProfile');

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search OR specializations.name ILIKE :search OR specializations.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');
    const users = await queryBuilder.getMany();

    return {
      success: true,
      data: users.map((u) => {
        const result = { ...u } as Omit<User, 'passwordHash'> & {
          passwordHash?: string;
        };
        delete result.passwordHash;
        return result;
      }),
    };
  }

  async updateStatus(id: string, status: UserStatus) {
    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    user.status = status;
    await userRepository.save(user);

    return {
      success: true,
      message: 'Cập nhật trạng thái người dùng thành công',
      data: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    };
  }

  async remove(id: string) {
    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    // Soft delete
    await userRepository.softDelete(id);

    return {
      success: true,
      message: 'Xóa tài khoản người dùng thành công',
    };
  }

  async findLecturers(search?: string, status?: UserStatus) {
    const userRepository = this.dataSource.getRepository(User);
    const queryBuilder = userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.lecturerProfile', 'lecturerProfile')
      .leftJoinAndSelect('lecturerProfile.specializations', 'specializations')
      .where('user.role = :role', { role: UserRole.LECTURER });

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search OR specializations.name ILIKE :search OR specializations.code ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');
    const lecturers = await queryBuilder.getMany();

    return {
      success: true,
      data: lecturers.map((u) => {
        const result = { ...u } as Omit<User, 'passwordHash'> & {
          passwordHash?: string;
        };
        delete result.passwordHash;
        return result;
      }),
    };
  }

  async findStudents(search?: string, status?: UserStatus) {
    const userRepository = this.dataSource.getRepository(User);
    const queryBuilder = userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.studentProfile', 'studentProfile')
      .where('user.role = :role', { role: UserRole.STUDENT });

    if (search) {
      queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search OR studentProfile.studentCode ILIKE :search OR studentProfile.address ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');
    const students = await queryBuilder.getMany();

    return {
      success: true,
      data: students.map((u) => {
        const result = { ...u } as Omit<User, 'passwordHash'> & {
          passwordHash?: string;
        };
        delete result.passwordHash;
        return result;
      }),
    };
  }

  async lockUser(id: string, lockUserDto: LockUserDto) {
    const { reason, lockedUntil } = lockUserDto;

    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Không thể khóa tài khoản Admin');
    }

    user.status = UserStatus.LOCKED;
    user.lockReason = reason;
    user.lockedUntil = lockedUntil ? new Date(lockedUntil) : null;
    await userRepository.save(user);

    // Hủy session hiện tại trong Redis để ngắt kết nối người dùng ngay lập tức
    await this.redisClient.del(`session:${id}`);

    // Gửi email thông báo
    this.mailService
      .sendAccountLockedEmail(
        user.email,
        user.fullName,
        reason,
        user.lockedUntil,
      )
      .catch((e) => console.error(e));

    return {
      success: true,
      message: 'Khóa tài khoản thành công',
      data: {
        id: user.id,
        email: user.email,
        status: user.status,
        lockReason: user.lockReason,
        lockedUntil: user.lockedUntil,
      },
    };
  }

  async unlockUser(id: string) {
    const userRepository = this.dataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    user.status = UserStatus.ACTIVE;
    user.lockReason = null;
    user.lockedUntil = null;
    await userRepository.save(user);

    // Gửi email thông báo
    this.mailService
      .sendAccountUnlockedEmail(user.email, user.fullName)
      .catch((e) => console.error(e));

    return {
      success: true,
      message: 'Mở khóa tài khoản thành công',
      data: {
        id: user.id,
        email: user.email,
        status: user.status,
      },
    };
  }

  async updateLecturer(id: string, updateLecturerDto: UpdateLecturerDto) {
    const { email, fullName, phone, specializationIds, experienceYears, degree, skills, bio } =
      updateLecturerDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userRepository = queryRunner.manager.getRepository(User);
      const lecturerProfileRepository =
        queryRunner.manager.getRepository(LecturerProfile);

      const user = await userRepository.findOne({
        where: { id },
        relations: { lecturerProfile: { specializations: true } },
      });

      if (!user) {
        throw new BadRequestException('Giảng viên không tồn tại');
      }

      if (user.role !== UserRole.LECTURER) {
        throw new BadRequestException('Người dùng không phải là Giảng viên');
      }

      // Check email uniqueness if email is changed
      if (email && email !== user.email) {
        const existingEmail = await userRepository.findOne({ where: { email } });
        if (existingEmail) {
          throw new BadRequestException('Email này đã được sử dụng bởi người dùng khác');
        }
        user.email = email;
      }

      if (fullName !== undefined) user.fullName = fullName;
      if (phone !== undefined) user.phone = phone;

      // Update or create profile
      let profile = user.lecturerProfile;
      if (!profile) {
        profile = lecturerProfileRepository.create({ userId: user.id });
      }

      if (experienceYears !== undefined) profile.experienceYears = experienceYears;
      if (degree !== undefined) profile.degree = degree;
      if (skills !== undefined) profile.skills = skills;
      if (bio !== undefined) profile.bio = bio;

      if (specializationIds !== undefined) {
        let specializations: Specialization[] = [];
        if (specializationIds.length > 0) {
          const specializationRepository = queryRunner.manager.getRepository(Specialization);
          specializations = await specializationRepository.createQueryBuilder('s')
            .where('s.id IN (:...ids)', { ids: specializationIds })
            .getMany();
        }
        profile.specializations = specializations;
      }

      await lecturerProfileRepository.save(profile);
      const savedUser = await userRepository.save(user);
      await queryRunner.commitTransaction();

      // Exclude password Hash
      const result = { ...savedUser } as Omit<User, 'passwordHash'> & {
        passwordHash?: string;
      };
      delete result.passwordHash;

      return {
        success: true,
        message: 'Cập nhật tài khoản Giảng viên thành công',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) throw error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Có lỗi xảy ra khi cập nhật tài khoản giảng viên: ' + errorMessage,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async updateStudent(id: string, updateStudentDto: UpdateStudentDto) {
    const { email, fullName, phone, studentCode, dateOfBirth, address, school, major, learningGoal, bio } =
      updateStudentDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userRepository = queryRunner.manager.getRepository(User);
      const studentProfileRepository =
        queryRunner.manager.getRepository(StudentProfile);

      const user = await userRepository.findOne({
        where: { id },
        relations: { studentProfile: true },
      });

      if (!user) {
        throw new BadRequestException('Học viên không tồn tại');
      }

      if (user.role !== UserRole.STUDENT) {
        throw new BadRequestException('Người dùng không phải là Học viên');
      }

      // Check email uniqueness if email is changed
      if (email && email !== user.email) {
        const existingEmail = await userRepository.findOne({ where: { email } });
        if (existingEmail) {
          throw new BadRequestException('Email này đã được sử dụng bởi người dùng khác');
        }
        user.email = email;
      }

      if (fullName !== undefined) user.fullName = fullName;
      if (phone !== undefined) user.phone = phone;

      // Update or create profile
      let profile = user.studentProfile;
      if (!profile) {
        profile = studentProfileRepository.create({ userId: user.id });
      }

      // Check student code uniqueness if changed
      if (studentCode !== undefined && studentCode !== profile.studentCode) {
        const existingCode = await studentProfileRepository.findOne({
          where: { studentCode },
        });
        if (existingCode) {
          throw new BadRequestException('Mã học viên này đã tồn tại');
        }
        profile.studentCode = studentCode;
      }

      if (dateOfBirth !== undefined) {
        profile.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      }
      if (address !== undefined) {
        profile.address = address;
      }
      if (school !== undefined) {
        profile.school = school;
      }
      if (major !== undefined) {
        profile.major = major;
      }
      if (learningGoal !== undefined) {
        profile.learningGoal = learningGoal;
      }
      if (bio !== undefined) {
        profile.bio = bio;
      }

      await studentProfileRepository.save(profile);
      const savedUser = await userRepository.save(user);
      await queryRunner.commitTransaction();

      // Exclude password Hash
      const result = { ...savedUser } as Omit<User, 'passwordHash'> & {
        passwordHash?: string;
      };
      delete result.passwordHash;

      return {
        success: true,
        message: 'Cập nhật tài khoản Học viên thành công',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) throw error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        'Có lỗi xảy ra khi cập nhật tài khoản học viên: ' + errorMessage,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async importStudents(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng tải lên file Excel hợp lệ');
    }

    let workbook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch (e) {
      throw new BadRequestException('Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file.');
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

    if (rows.length <= 1) {
      throw new BadRequestException('File Excel không có dữ liệu hoặc thiếu tiêu đề');
    }

    const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
    const emailIdx = headers.findIndex((h) => h.includes('email'));
    const nameIdx = headers.findIndex(
      (h) => h.includes('tên') || h.includes('name') || h.includes('họ'),
    );
    const codeIdx = headers.findIndex((h) => h.includes('mã') || h.includes('code'));
    const phoneIdx = headers.findIndex(
      (h) => h.includes('điện thoại') || h.includes('phone') || h.includes('sđt'),
    );
    const dobIdx = headers.findIndex(
      (h) => h.includes('sinh') || h.includes('birth') || h.includes('dob'),
    );
    const addressIdx = headers.findIndex(
      (h) => h.includes('địa chi') || h.includes('địa chỉ') || h.includes('address'),
    );

    if (emailIdx === -1 || nameIdx === -1 || codeIdx === -1) {
      throw new BadRequestException(
        'File Excel phải chứa các cột bắt buộc: Email, Họ và Tên, Mã học viên',
      );
    }

    const results = {
      successCount: 0,
      errorCount: 0,
      details: [] as {
        row: number;
        email?: string;
        studentCode?: string;
        success: boolean;
        message: string;
      }[],
    };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Skip completely empty rows
      if (!row || row.length === 0 || row.every((val) => val === undefined || val === null || val === '')) {
        continue;
      }

      const email = String(row[emailIdx] || '').trim();
      const fullName = String(row[nameIdx] || '').trim();
      const studentCode = String(row[codeIdx] || '').trim();
      const phone =
        phoneIdx !== -1 && row[phoneIdx] !== undefined && row[phoneIdx] !== null
          ? String(row[phoneIdx]).trim()
          : null;
      const rawDob = dobIdx !== -1 ? row[dobIdx] : null;
      const address =
        addressIdx !== -1 && row[addressIdx] !== undefined && row[addressIdx] !== null
          ? String(row[addressIdx]).trim()
          : null;

      // Basic validation
      if (!email || !fullName || !studentCode) {
        results.errorCount++;
        results.details.push({
          row: i + 1,
          email: email || undefined,
          studentCode: studentCode || undefined,
          success: false,
          message: 'Thiếu thông tin bắt buộc (Email, Họ và Tên, hoặc Mã học viên)',
        });
        continue;
      }

      // Email formatting validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        results.errorCount++;
        results.details.push({
          row: i + 1,
          email,
          studentCode,
          success: false,
          message: 'Email không đúng định dạng',
        });
        continue;
      }

      let dateOfBirth: Date | null = null;
      if (rawDob !== undefined && rawDob !== null && rawDob !== '') {
        if (typeof rawDob === 'number') {
          // Convert Excel date serial number to JS Date
          dateOfBirth = new Date((rawDob - 25569) * 86400 * 1000);
        } else {
          const parsedDate = new Date(String(rawDob).trim());
          if (!isNaN(parsedDate.getTime())) {
            dateOfBirth = parsedDate;
          }
        }
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const userRepository = queryRunner.manager.getRepository(User);
        const studentProfileRepository =
          queryRunner.manager.getRepository(StudentProfile);

        // Check unique email
        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser) {
          throw new BadRequestException('Email đã tồn tại trong hệ thống');
        }

        // Check unique studentCode
        const existingCode = await studentProfileRepository.findOne({
          where: { studentCode },
        });
        if (existingCode) {
          throw new BadRequestException('Mã học viên đã tồn tại');
        }

        // Generate random password
        const plainPassword = this.generateRandomPassword();
        const passwordHash = await bcrypt.hash(plainPassword, 10);

        // Create user
        const user = userRepository.create({
          email,
          passwordHash,
          fullName,
          phone,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
        });
        const savedUser = await userRepository.save(user);

        // Create student profile
        const profile = studentProfileRepository.create({
          userId: savedUser.id,
          studentCode,
          dateOfBirth,
          address,
        });
        await studentProfileRepository.save(profile);

        await queryRunner.commitTransaction();

        // Send email in background
        this.mailService
          .sendAccountCreatedEmail(
            email,
            fullName,
            plainPassword,
            UserRole.STUDENT,
          )
          .catch((e) => console.error(`Error sending mail to ${email}:`, e));

        results.successCount++;
        results.details.push({
          row: i + 1,
          email,
          studentCode,
          success: true,
          message: 'Tạo học viên thành công',
        });
      } catch (err: any) {
        await queryRunner.rollbackTransaction();
        results.errorCount++;
        results.details.push({
          row: i + 1,
          email,
          studentCode,
          success: false,
          message: err.message || 'Có lỗi khi tạo tài khoản',
        });
      } finally {
        await queryRunner.release();
      }
    }

    return {
      success: true,
      message: `Import hoàn tất. Thành công: ${results.successCount}, Thất bại: ${results.errorCount}`,
      data: results,
    };
  }

  async getImportTemplate() {
    const headers = [
      ['Email', 'Họ và tên', 'Mã học viên', 'Số điện thoại', 'Ngày sinh', 'Địa chỉ'],
      ['nguyenvana@gmail.com', 'Nguyễn Văn A', 'HV001', '0912345678', '2004-05-15', 'Hà Nội'],
      ['tranvanb@gmail.com', 'Trần Văn B', 'HV002', '0987654321', '2003-10-20', 'Đà Nẵng'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Import');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async getProfile(userId: string, role: UserRole) {
    const userRepository = this.dataSource.getRepository(User);
    const relations =
      role === UserRole.LECTURER
        ? { lecturerProfile: { specializations: true } }
        : role === UserRole.STUDENT
          ? { studentProfile: true }
          : {};

    const user = await userRepository.findOne({
      where: { id: userId },
      relations,
    });

    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại');
    }

    const result = { ...user } as Omit<User, 'passwordHash'> & {
      passwordHash?: string;
    };
    delete result.passwordHash;

    return {
      success: true,
      data: result,
    };
  }

  private extractPublicIdFromUrl(url: string): string | null {
    if (!url || !url.includes('cloudinary.com')) return null;
    try {
      const parts = url.split('/upload/');
      if (parts.length < 2) return null;
      const pathAfterUpload = parts[1];
      const pathSegments = pathAfterUpload.split('/');
      if (pathSegments[0].match(/^v\d+$/)) {
        pathSegments.shift();
      }
      const publicIdWithExt = pathSegments.join('/');
      const lastDotIndex = publicIdWithExt.lastIndexOf('.');
      if (lastDotIndex === -1) return publicIdWithExt;
      return publicIdWithExt.substring(0, lastDotIndex);
    } catch (e) {
      return null;
    }
  }

  async updateProfile(userId: string, role: UserRole, updateDto: UpdateProfileDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const publicIdsToDelete: string[] = [];

    try {
      const userRepository = queryRunner.manager.getRepository(User);
      const lecturerProfileRepository =
        queryRunner.manager.getRepository(LecturerProfile);
      const studentProfileRepository =
        queryRunner.manager.getRepository(StudentProfile);

      const user = await userRepository.findOne({
        where: { id: userId },
        relations:
          role === UserRole.LECTURER
            ? { lecturerProfile: { specializations: true } }
            : role === UserRole.STUDENT
              ? { studentProfile: true }
              : {},
      });

      if (!user) {
        throw new BadRequestException('Người dùng không tồn tại');
      }

      // Check avatar replacement to clean up old avatar
      if (updateDto.avatarUrl !== undefined && updateDto.avatarUrl !== user.avatarUrl) {
        if (user.avatarUrl) {
          const oldAvatarPublicId = this.extractPublicIdFromUrl(user.avatarUrl);
          if (oldAvatarPublicId) {
            publicIdsToDelete.push(oldAvatarPublicId);
          }
        }
        user.avatarUrl = updateDto.avatarUrl;
      }

      // Update common fields
      if (updateDto.fullName !== undefined) user.fullName = updateDto.fullName;
      if (updateDto.phone !== undefined) user.phone = updateDto.phone;

      if (role === UserRole.LECTURER) {
        let profile = user.lecturerProfile;
        if (!profile) {
          profile = lecturerProfileRepository.create({ userId: user.id });
        }

        if (updateDto.specializationIds !== undefined) {
          let specializations: Specialization[] = [];
          if (updateDto.specializationIds.length > 0) {
            const specializationRepository = queryRunner.manager.getRepository(Specialization);
            specializations = await specializationRepository.createQueryBuilder('s')
              .where('s.id IN (:...ids)', { ids: updateDto.specializationIds })
              .getMany();
          }
          profile.specializations = specializations;
        }
        if (updateDto.experienceYears !== undefined) {
          profile.experienceYears = updateDto.experienceYears;
        }
        if (updateDto.degree !== undefined) {
          profile.degree = updateDto.degree;
        }
        if (updateDto.skills !== undefined) {
          profile.skills = updateDto.skills;
        }
        if (updateDto.bio !== undefined) {
          profile.bio = updateDto.bio;
        }

        // Compare and cleanup old certificate images on Cloudinary
        if (updateDto.certificates !== undefined) {
          const newCerts = updateDto.certificates || [];
          const oldCerts = (profile.certificates as any[]) || [];

          // Collect all public IDs in old certificates
          const oldPublicIds = new Set<string>();
          oldCerts.forEach((c) => {
            if (c.frontImagePublicId) oldPublicIds.add(c.frontImagePublicId);
            if (c.backImagePublicId) oldPublicIds.add(c.backImagePublicId);
          });

          // Collect all public IDs in new certificates
          const newPublicIds = new Set<string>();
          newCerts.forEach((c) => {
            if (c.frontImagePublicId) newPublicIds.add(c.frontImagePublicId);
            if (c.backImagePublicId) newPublicIds.add(c.backImagePublicId);
          });

          // Any public ID that is in old but not in new should be deleted
          oldPublicIds.forEach((id) => {
            if (!newPublicIds.has(id)) {
              publicIdsToDelete.push(id);
            }
          });

          profile.certificates = newCerts;
        }

        await lecturerProfileRepository.save(profile);
      } else if (role === UserRole.STUDENT) {
        let profile = user.studentProfile;
        if (!profile) {
          profile = studentProfileRepository.create({ userId: user.id });
        }

        if (updateDto.dateOfBirth !== undefined) {
          profile.dateOfBirth = updateDto.dateOfBirth
            ? new Date(updateDto.dateOfBirth)
            : null;
        }
        if (updateDto.address !== undefined) {
          profile.address = updateDto.address;
        }
        if (updateDto.school !== undefined) {
          profile.school = updateDto.school;
        }
        if (updateDto.major !== undefined) {
          profile.major = updateDto.major;
        }
        if (updateDto.learningGoal !== undefined) {
          profile.learningGoal = updateDto.learningGoal;
        }
        if (updateDto.bio !== undefined) {
          profile.bio = updateDto.bio;
        }

        await studentProfileRepository.save(profile);
      }

      const savedUser = await userRepository.save(user);
      await queryRunner.commitTransaction();

      // Trigger asynchronous deletion of replaced files on Cloudinary in the background
      if (publicIdsToDelete.length > 0) {
        Promise.all(
          publicIdsToDelete.map((pid) =>
            this.cloudinaryService
              .deleteFile(pid)
              .catch((err) =>
                console.error(`Failed to delete file ${pid} from Cloudinary:`, err),
              ),
          ),
        ).catch((err) => console.error('Cloudinary cleanup error:', err));
      }

      const result = { ...savedUser } as Omit<User, 'passwordHash'> & {
        passwordHash?: string;
      };
      delete result.passwordHash;

      return {
        success: true,
        message: 'Cập nhật thông tin cá nhân thành công',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new BadRequestException('Cập nhật thất bại: ' + errorMessage);
    } finally {
      await queryRunner.release();
    }
  }

  async uploadLecturerAvatar(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file ảnh để upload');
    }
    try {
      const result = await this.cloudinaryService.uploadFile(file, {
        folder: 'educenter/lecturers/avatars',
        resource_type: 'image',
      });
      return {
        success: true,
        data: {
          url: result.secure_url,
          publicId: result.public_id,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new BadRequestException('Upload avatar thất bại: ' + msg);
    }
  }
}
