import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Stream } from '../../streaming/entities/stream.entity';
import { User } from '../../users/entities/user.entity';

export enum StreamMessageType {
  CHAT = 'chat',
  SUPER_CHAT = 'super_chat',
  SYSTEM = 'system',
}

@Entity('stream_messages')
@Index(['streamId', 'createdAt'])
@Index(['streamId', 'streamOffsetMs'])
export class StreamMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stream_id', type: 'uuid' })
  streamId: string;

  @ManyToOne(() => Stream, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stream_id' })
  stream: Stream;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 500 })
  body: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'stream_offset_ms', type: 'bigint', nullable: true })
  streamOffsetMs: number | null;

  @Column({
    name: 'message_type',
    type: 'enum',
    enum: StreamMessageType,
    default: StreamMessageType.CHAT,
  })
  messageType: StreamMessageType;

  @Column({ name: 'amount_cents', type: 'int', nullable: true })
  amountCents: number | null;

  @Column({ name: 'highlight_seconds', type: 'int', nullable: true })
  highlightSeconds: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
