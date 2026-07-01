import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AudienceRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn',
}

export enum AudienceRequestType {
  QUESTION = 'question',
  SPEAK = 'speak',
  GUEST = 'guest',
}

@Entity('stream_audience_requests')
@Index(['streamId', 'userId'], { unique: true })
@Index(['streamId', 'status'])
export class StreamAudienceRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stream_id', type: 'uuid' })
  streamId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    name: 'request_type',
    type: 'varchar',
    length: 20,
    default: AudienceRequestType.QUESTION,
  })
  requestType: AudienceRequestType;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: AudienceRequestStatus.PENDING,
  })
  status: AudienceRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
