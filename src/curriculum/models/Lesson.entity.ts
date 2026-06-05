import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CurriculumChapter } from './CurriculumChapter.entity';

export enum LessonStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chapter_id', type: 'uuid' })
  chapterId: string;

  @ManyToOne(() => CurriculumChapter, (chapter) => chapter.lessons)
  @JoinColumn({ name: 'chapter_id' })
  chapter: CurriculumChapter;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'content_summary', type: 'text', nullable: true })
  contentSummary: string | null;

  @Column({ name: 'order_index', type: 'int', default: 0 })
  orderIndex: number;

  @Column({ type: 'enum', enum: LessonStatus, default: LessonStatus.DRAFT })
  status: LessonStatus;

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
