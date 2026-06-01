import { Entity, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { User } from '../../users/models/User.entity';
import { Course } from './Course.entity';
import { Class } from './Class.entity';

@Entity('teaching_assignments')
export class TeachingAssignment {
    @PrimaryColumn({ name: 'lecturer_id', type: 'uuid' })
    lecturerId: string;

    @PrimaryColumn({ name: 'course_id', type: 'uuid' })
    courseId: string;

    @PrimaryColumn({ name: 'class_id', type: 'uuid' })
    classId: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'lecturer_id' })
    lecturer: User;

    @ManyToOne(() => Course)
    @JoinColumn({ name: 'course_id' })
    course: Course;

    @ManyToOne(() => Class)
    @JoinColumn({ name: 'class_id' })
    teachingClass: Class;

    @Column({ type: 'varchar', length: 100 })
    role: string;

    @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
    assignedAt: Date;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
