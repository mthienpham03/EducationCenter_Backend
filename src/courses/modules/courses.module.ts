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
import { ClassCronService } from '../services/class-cron.service';
import { UsersModule } from '../../users/modules/users.module';

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
    UsersModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService, ClassCronService],
  exports: [CoursesService, TypeOrmModule],
})
export class CoursesModule {}
