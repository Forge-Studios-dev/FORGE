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
  QUESTION = 'question',
}

export enum StreamQuestionStatus {
  PENDING = 'pending',
  ANSWERED = 'answered',
  DISMISSED = 'dismissed',
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

  /** Super Chat only — platform fee percent applied at payment time (0–100). */
  @Column({
    name: 'platform_fee_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | number | null) => (v == null ? null : Number(v)),
    },
  })
  platformFeePercent: number | null;

  @Column({ name: 'platform_fee_cents', type: 'int', nullable: true })
  platformFeeCents: number | null;

  @Column({ name: 'creator_net_cents', type: 'int', nullable: true })
  creatorNetCents: number | null;

  /** Super Chat only — checkout session id, needed to reconcile a later refund/dispute. */
  @Column({ name: 'stripe_checkout_session_id', type: 'varchar', nullable: true })
  stripeCheckoutSessionId: string | null;

  /** Set when Stripe reports the underlying charge refunded or disputed — excluded from earnings totals. */
  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @Column({ name: 'highlight_seconds', type: 'int', nullable: true })
  highlightSeconds: number | null;

  /** Lifecycle for `question` messages (Live Q&A): pending | answered | dismissed. Null for chat. */
  @Column({ name: 'question_status', type: 'varchar', length: 16, nullable: true })
  questionStatus: StreamQuestionStatus | null;

  /** Audience upvote tally for `question` messages. */
  @Column({ name: 'upvotes', type: 'int', default: 0 })
  upvotes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
