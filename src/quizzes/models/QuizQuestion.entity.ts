import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { Quiz } from './Quiz.entity';
import { QuestionBank } from './QuestionBank.entity';

@Entity('quiz_questions')
export class QuizQuestion {
    @PrimaryColumn({ name: 'quiz_id', type: 'uuid' })
    quizId: string;

    @PrimaryColumn({ name: 'question_id', type: 'uuid' })
    questionId: string;

    @ManyToOne(() => Quiz)
    @JoinColumn({ name: 'quiz_id' })
    quiz: Quiz;

    @ManyToOne(() => QuestionBank)
    @JoinColumn({ name: 'question_id' })
    question: QuestionBank;

    @Column({ type: 'real', default: 1 })
    score: number;

    @Column({ name: 'order_index', type: 'int', default: 0 })
    orderIndex: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
