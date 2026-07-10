import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quiz } from '../models/Quiz.entity';
import { QuizQuestion } from '../models/QuizQuestion.entity';
import { QuizAttempt } from '../models/QuizAttempt.entity';
import { QuizAnswer } from '../models/QuizAnswer.entity';
import { QuestionBank } from '../models/QuestionBank.entity';
import { QuestionOption } from '../models/QuestionOption.entity';
import { Course } from '../../courses/models/Course.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';
import { Enrollment } from '../../courses/models/Enrollment.entity';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';
import { QuizzesController } from '../controllers/quizzes.controller';
import { QuizzesService } from '../services/quizzes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Quiz,
      QuizQuestion,
      QuizAttempt,
      QuizAnswer,
      QuestionBank,
      QuestionOption,
      Course,
      Lesson,
      Enrollment,
      TeachingAssignment,
    ]),
  ],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
