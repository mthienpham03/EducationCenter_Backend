import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Course } from '../../courses/models/Course.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';

export enum QuizStatus {
    DRAFT = 'draft',
    OPEN = 'open',
    CLOSED = 'closed',
    ARCHIVED = 'archived',
}

@Entity('quizzes')
export class Quiz {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'course_id', type: 'uuid' })
    courseId: string;

    @ManyToOne(() => Course)
    @JoinColumn({ name: 'course_id' })
    course: Course;

    @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
    lessonId: string | null;

    @ManyToOne(() => Lesson)
    @JoinColumn({ name: 'lesson_id' })
    lesson: Lesson | null;

    @Column({ type: 'varchar', length: 255 })
    title: string;

    @Column({ name: 'duration_minutes', type: 'int', nullable: true })
    durationMinutes: number | null;

    @Column({ name: 'max_attempts', type: 'int', default: 1 })
    maxAttempts: number;

    @Column({ name: 'shuffle_questions', type: 'boolean', default: false })
    shuffleQuestions: boolean;

    @Column({ type: 'enum', enum: QuizStatus, default: QuizStatus.DRAFT })
    status: QuizStatus;

    @Column({ name: 'created_by', type: 'uuid', nullable: true })
    createdBy: string | null;

    @Column({ name: 'updated_by', type: 'uuid', nullable: true })
    updatedBy: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
    deletedAt: Date | null;
}
