import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CommunityRoom } from './community-room.entity';
import { User } from '../../users/entities/user.entity';

@Entity('community_room_messages')
@Index(['roomId', 'createdAt'])
export class CommunityRoomMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @ManyToOne(() => CommunityRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: CommunityRoom;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 2000 })
  body: string;

  @Column({ name: 'parent_message_id', type: 'uuid', nullable: true })
  parentMessageId: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

export enum CommunityRoomPermission {
  VIEW = 'view',
  SEND = 'send',
  MODERATE = 'moderate',
}

@Entity('community_room_permissions')
@Index(['roomId'])
export class CommunityRoomPermissionRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 64 })
  permission: CommunityRoomPermission;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

@Entity('creator_audit_logs')
@Index(['creatorId', 'createdAt'])
export class CreatorAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ length: 128 })
  action: string;

  @Column({ name: 'resource_type', length: 64, nullable: true })
  resourceType: string | null;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
