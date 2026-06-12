import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/models/User.entity';
import { Course } from './Course.entity';
import { Class } from './Class.entity';

@Entity('class_transfer_histories')
export class ClassTransferHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @ManyToOne(() => Course)
  @JoinColumn({ name: 'course_id' })
  course: Course;

  @Column({ name: 'from_class_id', type: 'uuid' })
  fromClassId: string;

  @ManyToOne(() => Class)
  @JoinColumn({ name: 'from_class_id' })
  fromClass: Class;

  @Column({ name: 'to_class_id', type: 'uuid' })
  toClassId: string;

  @ManyToOne(() => Class)
  @JoinColumn({ name: 'to_class_id' })
  toClass: Class;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'transferred_by', type: 'uuid', nullable: true })
  transferredBy: string | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'transferred_by' })
  transferredByUser: User | null;

  @CreateDateColumn({ name: 'transferred_at', type: 'timestamptz' })
  transferredAt: Date;
}
