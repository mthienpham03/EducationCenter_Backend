import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/models/User.entity';

@Entity('lecturer_profiles')
export class LecturerProfile {
    @PrimaryColumn({ name: 'user_id', type: 'uuid' })
    userId: string;

    @OneToOne(() => User, user => user.lecturerProfile)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column({ type: 'varchar', length: 255, nullable: true })
    specialization: string | null;

    @Column({ name: 'experience_years', type: 'int', nullable: true })
    experienceYears: number | null;

    @Column({ type: 'text', nullable: true })
    bio: string | null;

    @Column({ type: 'jsonb', nullable: true })
    certificates: any;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;
}
