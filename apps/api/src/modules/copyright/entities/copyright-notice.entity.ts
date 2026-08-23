import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Video } from '../../content/entities/video.entity';

/**
 * DMCA (17 U.S.C. §512) notice-and-takedown intake. Fields mirror the
 * statute's required elements for a valid notice: identification of the
 * copyrighted work, identification of the infringing material, claimant
 * contact info, a good-faith-belief statement, an accuracy statement made
 * under penalty of perjury, and a signature. This is engineering scaffolding
 * for a well-defined external legal process, not an invented policy — the
 * one real-world step this can't do is registering a designated agent with
 * the U.S. Copyright Office; see docs/COPYRIGHT_DMCA.md.
 */
export enum CopyrightNoticeStatus {
  PENDING = 'pending',
  TAKEDOWN_ISSUED = 'takedown_issued',
  COUNTER_NOTICED = 'counter_noticed',
  REINSTATED = 'reinstated',
  REJECTED = 'rejected',
}

@Entity('copyright_notices')
@Index(['videoId'])
@Index(['status'])
export class CopyrightNotice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Nullable — ON DELETE SET NULL (not CASCADE). A legally defensible DMCA
   * record must survive the underlying video being deleted; hard-deleting
   * the notice along with its video would destroy the audit trail.
   */
  @Column({ name: 'video_id', type: 'uuid', nullable: true })
  videoId: string | null;

  @ManyToOne(() => Video, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'video_id' })
  video: Video | null;

  @Column({ name: 'claimant_name', type: 'varchar', length: 300 })
  claimantName: string;

  @Column({ name: 'claimant_email', type: 'varchar', length: 300 })
  claimantEmail: string;

  @Column({ name: 'claimant_address', type: 'varchar', length: 1000 })
  claimantAddress: string;

  /** Identification of the copyrighted work claimed to be infringed. */
  @Column({ name: 'work_description', type: 'varchar', length: 2000 })
  workDescription: string;

  /** Identification of the material claimed to be infringing (where on FORGE). */
  @Column({ name: 'infringing_description', type: 'varchar', length: 2000 })
  infringingDescription: string;

  /** "I have a good-faith belief that use ... is not authorized ..." */
  @Column({ name: 'good_faith_statement', type: 'boolean' })
  goodFaithStatement: boolean;

  /** "... information in this notification is accurate, and ... under penalty of perjury, that I am authorized to act ..." */
  @Column({ name: 'accuracy_statement', type: 'boolean' })
  accuracyStatement: boolean;

  @Column({ type: 'varchar', length: 300 })
  signature: string;

  @Column({ type: 'varchar', length: 32, default: CopyrightNoticeStatus.PENDING })
  status: CopyrightNoticeStatus;

  /** Video's visibility before the takedown — restored verbatim on reinstatement, not forced to PUBLIC. */
  @Column({ name: 'previous_visibility', type: 'varchar', length: 32, nullable: true })
  previousVisibility: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
