import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from './users/models/User.entity';
import { LecturerProfile } from './lecturers/models/LecturerProfile.entity';
import { StudentProfile } from './students/models/StudentProfile.entity';
import { Specialization } from './specializations/models/Specialization.entity';
import { Course, CourseStatus } from './courses/models/Course.entity';
import { Class, ClassStatus } from './courses/models/Class.entity';
import { Enrollment, EnrollmentStatus } from './courses/models/Enrollment.entity';
import { TeachingAssignment } from './courses/models/TeachingAssignment.entity';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const userRepository = dataSource.getRepository(User);

  // --- Seed default Admin ---
  const adminEmail = 'admin@educenter.com';
  let savedAdmin = await userRepository.findOne({
    where: { email: adminEmail },
  });

  if (savedAdmin) {
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

    savedAdmin = await userRepository.save(newAdmin);
    console.log('Default Admin account created successfully!');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: admin123`);
  }

  // --- Seed default Lecturer ---
  const lecturerEmail = 'lecturer@educenter.com';
  let savedLecturer = await userRepository.findOne({
    where: { email: lecturerEmail },
  });

  if (savedLecturer) {
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

    savedLecturer = await userRepository.save(newLecturer);

    const specializationRepository = dataSource.getRepository(Specialization);
    let spec = await specializationRepository.findOne({ where: { code: 'IT' } });
    if (!spec) {
      spec = specializationRepository.create({
        code: 'IT',
        name: 'Information Technology',
        description: 'Chuyên ngành Công nghệ thông tin',
      });
      spec = await specializationRepository.save(spec);
    }

    const lecturerProfileRepository = dataSource.getRepository(LecturerProfile);
    const lecturerProfile = lecturerProfileRepository.create({
      userId: savedLecturer.id,
      specializations: [spec],
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
  let savedStudent = await userRepository.findOne({
    where: { email: studentEmail },
  });

  if (savedStudent) {
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

    savedStudent = await userRepository.save(newStudent);

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

  // --- Seed Courses and Classes ---
  console.log('Seeding courses and classes...');
  const courseRepository = dataSource.getRepository(Course);
  const classRepository = dataSource.getRepository(Class);
  const teachingAssignmentRepository = dataSource.getRepository(TeachingAssignment);
  const enrollmentRepository = dataSource.getRepository(Enrollment);

  const courseData = [
    { code: 'CS101', name: 'Nhập môn Khoa học Máy tính', description: 'Giới thiệu về khoa học máy tính và lập trình cơ bản', status: CourseStatus.PUBLISHED },
    { code: 'CS102', name: 'Cấu trúc Dữ liệu và Giải thuật', description: 'Các cấu trúc dữ liệu cơ bản và giải thuật thông dụng', status: CourseStatus.PUBLISHED },
    { code: 'CS103', name: 'Lập trình Web nâng cao', description: 'Xây dựng ứng dụng web với React và Node.js', status: CourseStatus.DRAFT },
    { code: 'CS104', name: 'Trí tuệ Nhân tạo', description: 'Khái niệm cơ bản về AI và Học máy', status: CourseStatus.PUBLISHED },
    { code: 'CS105', name: 'Kiến trúc Phần mềm nâng cao', description: 'Các mẫu thiết kế và kiến trúc hệ thống lớn', status: CourseStatus.PUBLISHED },
  ];

  const coursesMap: Record<string, Course> = {};

  for (const c of courseData) {
    let course = await courseRepository.findOne({ where: { code: c.code } });
    if (!course) {
      course = courseRepository.create({
        code: c.code,
        name: c.name,
        description: c.description,
        status: c.status,
        createdBy: savedAdmin?.id || null,
        updatedBy: savedAdmin?.id || null,
      });
      course = await courseRepository.save(course);
      console.log(`Created course: ${c.code}`);
    } else {
      console.log(`Course ${c.code} already exists. Skipping...`);
    }
    coursesMap[c.code] = course;
  }

  // Create Classes for each Course if they do not exist
  const classesMap: Record<string, Class> = {};
  for (const code of Object.keys(coursesMap)) {
    const course = coursesMap[code];
    const className = `${code}-L01`;
    let cls = await classRepository.findOne({ where: { courseId: course.id, name: className } });
    if (!cls) {
      cls = classRepository.create({
        courseId: course.id,
        name: className,
        maxStudents: 30,
        status: ClassStatus.ACTIVE,
        expectedStartDate: new Date(new Date().setDate(new Date().getDate() - 10)), // 10 ngày trước
        expectedEndDate: new Date(new Date().setDate(new Date().getDate() + 80)), // 80 ngày sau
        scheduleNote: 'Tối thứ 2-4-6 từ 18:00 - 20:00',
        createdBy: savedAdmin?.id || null,
        updatedBy: savedAdmin?.id || null,
      });
      cls = await classRepository.save(cls);
      console.log(`Created class: ${className}`);
    } else {
      console.log(`Class ${className} already exists. Skipping...`);
    }
    classesMap[code] = cls;
  }

  // --- Assign Lecturer (lecturer@educenter.com) ---
  // Lecturer will be assigned to CS101-L01 and CS103-L01
  if (savedLecturer) {
    const assignmentsToCreate = [
      { code: 'CS101', role: 'Main Lecturer' },
      { code: 'CS103', role: 'Main Lecturer' },
    ];

    for (const item of assignmentsToCreate) {
      const course = coursesMap[item.code];
      const cls = classesMap[item.code];
      if (course && cls) {
        let assign = await teachingAssignmentRepository.findOne({
          where: { lecturerId: savedLecturer.id, courseId: course.id, classId: cls.id }
        });
        if (!assign) {
          assign = teachingAssignmentRepository.create({
            lecturerId: savedLecturer.id,
            courseId: course.id,
            classId: cls.id,
            role: item.role,
          });
          await teachingAssignmentRepository.save(assign);
          console.log(`Assigned lecturer to ${item.code}`);
        }
      }
    }
  }

  // --- Enroll Student (student@educenter.com) ---
  // Student will be enrolled in CS101-L01 and CS102-L01
  if (savedStudent) {
    const enrollmentsToCreate = ['CS101', 'CS102'];

    for (const code of enrollmentsToCreate) {
      const course = coursesMap[code];
      const cls = classesMap[code];
      if (course && cls) {
        let enrollment = await enrollmentRepository.findOne({
          where: { studentId: savedStudent.id, courseId: course.id, classId: cls.id }
        });
        if (!enrollment) {
          enrollment = enrollmentRepository.create({
            studentId: savedStudent.id,
            courseId: course.id,
            classId: cls.id,
            status: EnrollmentStatus.ACTIVE,
            completedPercent: 0,
          });
          await enrollmentRepository.save(enrollment);
          console.log(`Enrolled student in ${code}`);
        }
      }
    }
  }

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});

