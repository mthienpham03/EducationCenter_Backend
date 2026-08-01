import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesController } from '../controllers/schedules.controller';
import { SchedulesService } from '../services/schedules.service';
import { Schedule } from '../models/Schedule.entity';
import { User } from '../../users/models/User.entity';
import { Course } from '../../courses/models/Course.entity';
import { Class } from '../../courses/models/Class.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Schedule, User, Course, Class, Lesson]),
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
