import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Course } from './Course.entity';

export enum ClassStatus {
    DRAFT = 'draft',
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
}

@Entity('classes')
export class Class {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'course_id', type: 'uuid' })
    courseId: string;

    @ManyToOne(() => Course, course => course.classes)
    @JoinColumn({ name: 'course_id' })
    course: Course;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @Column({ name: 'max_students', type: 'int', nullable: true })
    maxStudents: number | null;

    @Column({ type: 'enum', enum: ClassStatus, default: ClassStatus.DRAFT })
    status: ClassStatus;

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
