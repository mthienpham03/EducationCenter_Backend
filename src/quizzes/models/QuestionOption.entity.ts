import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { QuestionBank } from './QuestionBank.entity';

@Entity('question_options')
export class QuestionOption {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'question_id', type: 'uuid' })
    questionId: string;

    @ManyToOne(() => QuestionBank, qb => qb.options)
    @JoinColumn({ name: 'question_id' })
    question: QuestionBank;

    @Column({ type: 'text' })
    content: string;

    @Column({ name: 'is_correct', type: 'boolean', default: false })
    isCorrect: boolean;

    @Column({ name: 'order_index', type: 'int', default: 0 })
    orderIndex: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
