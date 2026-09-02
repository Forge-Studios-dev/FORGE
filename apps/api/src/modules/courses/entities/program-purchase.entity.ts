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
import { Course } from './course.entity';

@Entity('program_purchases')
@Index(['programId', 'userId'], { unique: true })
export class ProgramPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Bundle course row (isBundle=true). */
  @Column({ name: 'program_id', type: 'uuid' })
  programId: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program: Course;

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
