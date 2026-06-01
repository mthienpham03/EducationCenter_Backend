import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { User } from '../../users/models/User.entity';
import { Course } from './Course.entity';
import { Class } from './Class.entity';

export enum EnrollmentStatus {
    ACTIVE = 'active',
    TRANSFERRED = 'transferred',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
}

@Entity('enrollments')
export class Enrollment {
    @PrimaryColumn({ name: 'student_id', type: 'uuid' })
    studentId: string;

    @PrimaryColumn({ name: 'course_id', type: 'uuid' })
    courseId: string;

    @PrimaryColumn({ name: 'class_id', type: 'uuid' })
    classId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'student_id' })
    student: User;

    @ManyToOne(() => Course)
    @JoinColumn({ name: 'course_id' })
    course: Course;

    @ManyToOne(() => Class)
    @JoinColumn({ name: 'class_id' })
    studentClass: Class;

    @Column({ type: 'enum', enum: EnrollmentStatus, default: EnrollmentStatus.ACTIVE })
    status: EnrollmentStatus;

    @Column({ name: 'enrolled_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    enrolledAt: Date;

    @Column({ name: 'completed_percent', type: 'real', default: 0 })
    completedPercent: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
