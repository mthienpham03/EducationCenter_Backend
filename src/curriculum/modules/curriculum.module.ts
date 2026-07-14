import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumChapter } from '../models/CurriculumChapter.entity';
import { Lesson } from '../models/Lesson.entity';
import { Course } from '../../courses/models/Course.entity';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';
import { CurriculumController } from '../controllers/curriculum.controller';
import { CurriculumService } from '../services/curriculum.service';

@Module({
  imports: [TypeOrmModule.forFeature([CurriculumChapter, Lesson, Course, TeachingAssignment])],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
