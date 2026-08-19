import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FraudSignal {
  VELOCITY_PAYMENT = 'velocity_payment',
  REFUND_PATTERN = 'refund_pattern',
  CHARGEBACK = 'chargeback',
  RAPID_SUBSCRIBE_CANCEL = 'rapid_subscribe_cancel',
  NEW_ACCOUNT_HIGH_SPEND = 'new_account_high_spend',
  MULTI_ACCOUNT = 'multi_account',
  NEW_DEVICE_LOGIN = 'new_device_login',
  RAPID_IP_CHANGE = 'rapid_ip_change',
}

export enum FraudAlertStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
}

@Entity('fraud_alerts')
@Index(['userId', 'signal'])
@Index(['status', 'createdAt'])
export class FraudAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 60 })
  signal: FraudSignal;

  @Column({ name: 'risk_score', type: 'int' })
  riskScore: number;

  @Column({ type: 'varchar', length: 30, default: FraudAlertStatus.OPEN })
  status: FraudAlertStatus;

  @Column({ type: 'jsonb', default: '{}' })
  metadata: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
