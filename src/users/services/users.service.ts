import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../models/User.entity';
import { LecturerProfile } from '../../lecturers/models/LecturerProfile.entity';
import { StudentProfile } from '../../students/models/StudentProfile.entity';
import { CreateLecturerDto, CreateStudentDto } from '../dto/create-user.dto';
import { MailService } from '../../utils/mail/services/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private dataSource: DataSource,
    private mailService: MailService,
  ) {}

  private generateRandomPassword(length = 8): string {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  async createLecturer(createLecturerDto: CreateLecturerDto) {
    const { email, fullName, phone, specialization, experienceYears } = createLecturerDto;

    // Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userRepository = queryRunner.manager.getRepository(User);
      const lecturerProfileRepository = queryRunner.manager.getRepository(LecturerProfile);

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
        role: UserRole.LECTURER,
        status: UserStatus.ACTIVE,
      });
      const savedUser = await userRepository.save(user);

      // Create LecturerProfile
      const lecturerProfile = lecturerProfileRepository.create({
        userId: savedUser.id,
        specialization,
        experienceYears,
      });
      await lecturerProfileRepository.save(lecturerProfile);

      await queryRunner.commitTransaction();

      // Send Email in background (do not await to block response)
      this.mailService.sendAccountCreatedEmail(email, fullName, plainPassword, UserRole.LECTURER).catch(e => console.error(e));

      // Exclude password from response
      const { passwordHash: _, ...result } = savedUser;
      return {
        success: true,
        message: 'Tạo tài khoản Giảng viên thành công',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Có lỗi xảy ra khi tạo tài khoản giảng viên: ' + error.message);
    } finally {
      await queryRunner.release();
    }
  }

  async createStudent(createStudentDto: CreateStudentDto) {
    const { email, fullName, phone, studentCode, dateOfBirth, address } = createStudentDto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const userRepository = queryRunner.manager.getRepository(User);
      const studentProfileRepository = queryRunner.manager.getRepository(StudentProfile);

      const existingUser = await userRepository.findOne({ where: { email } });
      if (existingUser) {
        throw new BadRequestException('Email này đã tồn tại trong hệ thống');
      }

      const existingStudentCode = await studentProfileRepository.findOne({ where: { studentCode } });
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

      this.mailService.sendAccountCreatedEmail(email, fullName, plainPassword, UserRole.STUDENT).catch(e => console.error(e));

      const { passwordHash: _, ...result } = savedUser;
      return {
        success: true,
        message: 'Tạo tài khoản Học viên thành công',
        data: result,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Có lỗi xảy ra khi tạo tài khoản học viên: ' + error.message);
    } finally {
      await queryRunner.release();
    }
  }
}
