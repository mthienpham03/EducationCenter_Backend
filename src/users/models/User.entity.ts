import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    OneToOne,
} from 'typeorm';
import { LecturerProfile } from '../../lecturers/models/LecturerProfile.entity';
import { StudentProfile } from '../../students/models/StudentProfile.entity';

export enum UserRole {
    ADMIN = 'admin',
    LECTURER = 'lecturer',
    STUDENT = 'student',
}

export enum UserStatus {
    ACTIVE = 'active',
    INACTIVE = 'inactive',
    LOCKED = 'locked',
    PENDING = 'pending',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', unique: true, length: 255 })
    email: string;

    @Column({ type: 'varchar', name: 'password_hash', length: 255 })
    passwordHash: string;

    @Column({ type: 'varchar', name: 'full_name', length: 255 })
    fullName: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone: string | null;

    @Column({ type: 'varchar', name: 'avatar_url', length: 500, nullable: true })
    avatarUrl: string | null;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.STUDENT,
    })
    role: UserRole;

    @Column({
        type: 'enum',
        enum: UserStatus,
        default: UserStatus.PENDING,
    })
    status: UserStatus;

    @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
    lastLoginAt: Date | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
    updatedAt: Date;

    @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
    deletedAt: Date | null;

    @OneToOne(() => LecturerProfile, profile => profile.user)
    lecturerProfile: LecturerProfile;

    @OneToOne(() => StudentProfile, profile => profile.user)
    studentProfile: StudentProfile;
}