import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import { Class } from './Class.entity';
import { CurriculumChapter } from '../../curriculum/models/CurriculumChapter.entity';

export enum CourseStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

@Entity('courses')
export class Course {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', unique: true, length: 100 })
    code: string;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ name: 'thumbnail_url', type: 'varchar', length: 500, nullable: true })
    thumbnailUrl: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    level: string | null;

    @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.DRAFT })
    status: CourseStatus;

    @Column({ name: 'start_date', type: 'date', nullable: true })
    startDate: Date | null;

    @Column({ name: 'end_date', type: 'date', nullable: true })
    endDate: Date | null;

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

    @OneToMany(() => Class, cls => cls.course)
    classes: Class[];

    @OneToMany(() => CurriculumChapter, chapter => chapter.course)
    chapters: CurriculumChapter[];
}
