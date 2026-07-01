import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_referral_codes')
@Index(['userId'], { unique: true })
export class UserReferralCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ length: 12, unique: true })
  code: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

export enum ReferralStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

@Entity('user_referrals')
@Index(['referrerId'])
export class UserReferral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'referrer_id', type: 'uuid' })
  referrerId: string;

  @Column({ name: 'referred_user_id', type: 'uuid', unique: true })
  referredUserId: string;

  @Column({ name: 'referral_code', length: 12 })
  referralCode: string;

  @Column({ type: 'varchar', length: 10, default: ReferralStatus.PENDING })
  status: ReferralStatus;

  @Column({ name: 'reward_granted', type: 'boolean', default: false })
  rewardGranted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
