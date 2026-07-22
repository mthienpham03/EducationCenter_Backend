import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Course } from '../../courses/models/Course.entity';
import { Lesson } from '../../curriculum/models/Lesson.entity';
import { User } from '../../users/models/User.entity';
import { QuestionOption } from './QuestionOption.entity';

export enum QuestionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum QuestionApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('question_bank')
export class QuestionBank {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid', nullable: true })
  courseId: string | null;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course: Course | null;

  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string | null;

  @ManyToOne(() => Lesson)
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson | null;

  @Column({ type: 'varchar', name: 'question_type', length: 100 })
  questionType: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  difficulty: string | null;

  @Column({
    type: 'enum',
    enum: QuestionStatus,
    default: QuestionStatus.ACTIVE,
  })
  status: QuestionStatus;

  @Column({
    name: 'approval_status',
    type: 'enum',
    enum: QuestionApprovalStatus,
    default: QuestionApprovalStatus.PENDING,
  })
  approvalStatus: QuestionApprovalStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => QuestionOption, (option) => option.question)
  options: QuestionOption[];
}
