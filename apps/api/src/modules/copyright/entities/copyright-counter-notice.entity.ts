import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CopyrightNotice } from './copyright-notice.entity';
import { User } from '../../users/entities/user.entity';

/**
 * DMCA §512(g) counter-notification. On a valid counter-notice, the statute
 * requires reinstating the material within 10-14 business days unless the
 * claimant informs us they've filed a lawsuit — this system can't detect a
 * lawsuit automatically, so `reinstateEligibleAt` drives an auto-reinstate
 * job (see copyright.scheduler.ts) that an admin can cancel if they're
 * notified of litigation (`status` -> `REJECTED`).
 */
export enum CounterNoticeStatus {
  PENDING = 'pending',
  REINSTATED = 'reinstated',
  REJECTED = 'rejected',
}

@Entity('copyright_counter_notices')
@Index(['noticeId'])
@Index(['status', 'reinstateEligibleAt'])
export class CopyrightCounterNotice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'notice_id', type: 'uuid' })
  noticeId: string;

  @ManyToOne(() => CopyrightNotice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notice_id' })
  notice: CopyrightNotice;

  @Column({ name: 'uploader_user_id', type: 'uuid' })
  uploaderUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploader_user_id' })
  uploader: User;

  @Column({ name: 'contact_info', type: 'varchar', length: 1000 })
  contactInfo: string;

  /** "... good faith belief that the material was removed ... as a result of mistake or misidentification ..." */
  @Column({ name: 'good_faith_mistake_statement', type: 'boolean' })
  goodFaithMistakeStatement: boolean;

  /** Consent to jurisdiction of the claimant's federal district court (or, if outside the US, an appropriate judicial district). */
  @Column({ name: 'consent_to_jurisdiction', type: 'boolean' })
  consentToJurisdiction: boolean;

  @Column({ type: 'varchar', length: 300 })
  signature: string;

  @Column({ type: 'varchar', length: 16, default: CounterNoticeStatus.PENDING })
  status: CounterNoticeStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** now + 10 business days at creation — see class doc. */
  @Column({ name: 'reinstate_eligible_at', type: 'timestamptz' })
  reinstateEligibleAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
