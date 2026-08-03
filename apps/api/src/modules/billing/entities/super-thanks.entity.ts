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
import { Video } from '../../content/entities/video.entity';

/** Durable ledger for YouTube-style Super Thanks (VOD tips). */
@Entity('super_thanks')
@Index(['creatorId', 'createdAt'])
@Index(['videoId', 'createdAt'])
export class SuperThanks {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'video_id', type: 'uuid' })
  videoId: string;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'tipper_id', type: 'uuid' })
  tipperId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tipper_id' })
  tipper: User;

  @Column({ name: 'amount_cents', type: 'int' })
  amountCents: number;

  /** Platform fee percent applied at tip time (0–100). */
  @Column({
    name: 'platform_fee_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string | number | null) => (v == null ? 0 : Number(v)),
    },
  })
  platformFeePercent: number;

  @Column({ name: 'platform_fee_cents', type: 'int', default: 0 })
  platformFeeCents: number;

  @Column({ name: 'creator_net_cents', type: 'int', default: 0 })
  creatorNetCents: number;

  @Column({ length: 3, default: 'usd' })
  currency: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  body: string | null;

  @Column({ name: 'stripe_checkout_session_id', type: 'varchar', nullable: true, unique: true })
  stripeCheckoutSessionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
