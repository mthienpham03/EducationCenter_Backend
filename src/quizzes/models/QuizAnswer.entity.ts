import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { QuizAttempt } from './QuizAttempt.entity';
import { QuestionBank } from './QuestionBank.entity';

@Entity('quiz_answers')
export class QuizAnswer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'attempt_id', type: 'uuid' })
    attemptId: string;

    @Column({ name: 'question_id', type: 'uuid' })
    questionId: string;

    @ManyToOne(() => QuizAttempt)
    @JoinColumn({ name: 'attempt_id' })
    attempt: QuizAttempt;

    @ManyToOne(() => QuestionBank)
    @JoinColumn({ name: 'question_id' })
    question: QuestionBank;

    @Column({ name: 'answer_data', type: 'jsonb', nullable: true })
    answerData: any;

    @Column({ name: 'is_correct', type: 'boolean', nullable: true })
    isCorrect: boolean | null;

    @Column({ type: 'real', nullable: true })
    score: number | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
