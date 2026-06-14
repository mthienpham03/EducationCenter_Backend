import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { User } from '../../users/models/User.entity';
import { Specialization } from '../../specializations/models/Specialization.entity';

@Entity('lecturer_profiles')
export class LecturerProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => User, (user) => user.lecturerProfile)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToMany(() => Specialization, (specialization) => specialization.lecturerProfiles, { cascade: true })
  @JoinTable({
    name: 'lecturer_profiles_specializations',
    joinColumn: { name: 'lecturer_id', referencedColumnName: 'userId' },
    inverseJoinColumn: { name: 'specialization_id', referencedColumnName: 'id' },
  })
  specializations: Specialization[];

  @Column({ name: 'experience_years', type: 'int', nullable: true })
  experienceYears: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  degree: string | null;

  @Column({ type: 'text', nullable: true })
  skills: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'jsonb', nullable: true })
  certificates: any;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
