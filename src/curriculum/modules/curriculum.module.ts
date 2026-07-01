import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumChapter } from '../models/CurriculumChapter.entity';
import { Lesson } from '../models/Lesson.entity';
import { Course } from '../../courses/models/Course.entity';
import { CurriculumController } from '../controllers/curriculum.controller';
import { CurriculumService } from '../services/curriculum.service';

@Module({
  imports: [TypeOrmModule.forFeature([CurriculumChapter, Lesson, Course])],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
