import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'actor_id', type: 'uuid', nullable: true })
    actorId: string | null;

    @Column({ type: 'varchar', length: 255 })
    action: string;

    @Column({ type: 'varchar', name: 'entity_type', length: 100 })
    entityType: string;

    @Column({ name: 'entity_id', type: 'uuid', nullable: true })
    entityId: string | null;

    @Column({ type: 'varchar', name: 'ip_address', length: 45, nullable: true })
    ipAddress: string | null;

    @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
    createdAt: Date;
}
