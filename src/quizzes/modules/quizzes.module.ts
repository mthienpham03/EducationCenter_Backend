import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionBank } from '../models/QuestionBank.entity';
import { QuestionOption } from '../models/QuestionOption.entity';
import { Quiz } from '../models/Quiz.entity';
import { QuizAnswer } from '../models/QuizAnswer.entity';
import { QuizAttempt } from '../models/QuizAttempt.entity';
import { QuizQuestion } from '../models/QuizQuestion.entity';
import { Course } from '../../courses/models/Course.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';
import { TeachingAssignment } from '../../courses/models/TeachingAssignment.entity';

import { QuestionBankController } from '../controllers/question-bank.controller';
import { QuestionBankService } from '../services/question-bank.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      QuestionBank,
      QuestionOption,
      Quiz,
      QuizAnswer,
      QuizAttempt,
      QuizQuestion,
      Course,
      Lesson,
      TeachingAssignment,
    ]),
  ],
  controllers: [QuestionBankController],
  providers: [QuestionBankService],
})
export class QuizzesModule {}
