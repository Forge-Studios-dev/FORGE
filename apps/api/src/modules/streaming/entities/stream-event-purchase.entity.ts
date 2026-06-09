import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Stream } from './stream.entity';

@Entity('stream_event_purchases')
@Index(['streamId', 'userId'], { unique: true })
export class StreamEventPurchase {
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

  @Column({ name: 'stripe_checkout_session_id', type: 'varchar', nullable: true })
  stripeCheckoutSessionId: string | null;

  @Column({ name: 'stripe_payment_intent_id', type: 'varchar', nullable: true })
  stripePaymentIntentId: string | null;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  @Column({ length: 3, default: 'usd' })
  currency: string;

  @Column({ length: 32, default: 'completed' })
  status: string;

  @Column({ name: 'purchased_at', type: 'timestamptz' })
  purchasedAt: Date;

  /** purchase | admin_grant | creator_grant */
  @Column({ name: 'grant_source', length: 32, default: 'purchase' })
  grantSource: string;

  @Column({ name: 'granted_by_user_id', type: 'uuid', nullable: true })
  grantedByUserId: string | null;

  @Column({ name: 'grant_note', type: 'varchar', length: 500, nullable: true })
  grantNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
