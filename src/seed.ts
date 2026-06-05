import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from './users/models/User.entity';
import { LecturerProfile } from './lecturers/models/LecturerProfile.entity';
import { StudentProfile } from './students/models/StudentProfile.entity';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const userRepository = dataSource.getRepository(User);

  // --- Seed default Admin ---
  const adminEmail = 'admin@educenter.com';
  const existingAdmin = await userRepository.findOne({ where: { email: adminEmail } });

  if (existingAdmin) {
    console.log('Admin account already exists. Skipping...');
  } else {
    console.log('Creating default Admin account...');

    const passwordHash = await bcrypt.hash('admin123', 10);

    const newAdmin = userRepository.create({
      email: adminEmail,
      passwordHash: passwordHash,
      fullName: 'System Admin',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    await userRepository.save(newAdmin);
    console.log('Default Admin account created successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: admin123`);
  }

  // --- Seed default Lecturer ---
  const lecturerEmail = 'lecturer@educenter.com';
  const existingLecturer = await userRepository.findOne({ where: { email: lecturerEmail } });

  if (existingLecturer) {
    console.log('Lecturer account already exists. Skipping...');
  } else {
    console.log('Creating default Lecturer account...');

    const passwordHash = await bcrypt.hash('lecturer123', 10);

    const newLecturer = userRepository.create({
      email: lecturerEmail,
      passwordHash: passwordHash,
      fullName: 'Nguyen Van Giang',
      role: UserRole.LECTURER,
      status: UserStatus.ACTIVE,
    });

    const savedLecturer = await userRepository.save(newLecturer);

    const lecturerProfileRepository = dataSource.getRepository(LecturerProfile);
    const lecturerProfile = lecturerProfileRepository.create({
      userId: savedLecturer.id,
      specialization: 'Information Technology',
      experienceYears: 5,
      bio: 'Lecturer in Computer Science with 5 years of experience.',
    });
    await lecturerProfileRepository.save(lecturerProfile);

    console.log('Default Lecturer account created successfully!');
    console.log(`Email: ${lecturerEmail}`);
    console.log(`Password: lecturer123`);
  }

  // --- Seed default Student ---
  const studentEmail = 'student@educenter.com';
  const existingStudent = await userRepository.findOne({ where: { email: studentEmail } });

  if (existingStudent) {
    console.log('Student account already exists. Skipping...');
  } else {
    console.log('Creating default Student account...');

    const passwordHash = await bcrypt.hash('student123', 10);

    const newStudent = userRepository.create({
      email: studentEmail,
      passwordHash: passwordHash,
      fullName: 'Tran Van Hoc',
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
    });

    const savedStudent = await userRepository.save(newStudent);

    const studentProfileRepository = dataSource.getRepository(StudentProfile);
    const studentProfile = studentProfileRepository.create({
      userId: savedStudent.id,
      studentCode: 'STU001',
      dateOfBirth: new Date('2004-01-01'),
      address: 'Hanoi, Vietnam',
    });
    await studentProfileRepository.save(studentProfile);

    console.log('Default Student account created successfully!');
    console.log(`Email: ${studentEmail}`);
    console.log(`Password: student123`);
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
