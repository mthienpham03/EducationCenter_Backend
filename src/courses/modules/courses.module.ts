import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../models/Course.entity';
import { Class } from '../models/Class.entity';
import { Enrollment } from '../models/Enrollment.entity';
import { TeachingAssignment } from '../models/TeachingAssignment.entity';
import { ClassTransferHistory } from '../models/ClassTransferHistory.entity';
import { User } from '../../users/models/User.entity';
import { CoursesController } from '../controllers/courses.controller';
import { CoursesService } from '../services/courses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Course,
      Class,
      Enrollment,
      TeachingAssignment,
      ClassTransferHistory,
      User,
    ]),
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
