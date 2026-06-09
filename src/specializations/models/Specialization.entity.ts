import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LecturerProfile } from '../../lecturers/models/LecturerProfile.entity';

@Entity('specializations')
export class Specialization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, length: 255 })
  name: string;

  @Column({ type: 'varchar', unique: true, length: 100 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @ManyToMany(() => LecturerProfile, (profile) => profile.specializations)
  lecturerProfiles: LecturerProfile[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
