import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ResourceVisibility {
  PUBLIC = 'public',
  SUBSCRIBERS = 'subscribers',
  TIER = 'tier',
}

@Entity('creator_resources')
@Index(['creatorId'])
@Index(['creatorId', 'isActive'])
export class CreatorResource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** S3 object key for server-side presigned GET. */
  @Column({ name: 'file_key', length: 500 })
  fileKey: string;

  /** CloudFront / public URL (for public resources). */
  @Column({ name: 'file_url', length: 1000 })
  fileUrl: string;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes: number | null;

  @Column({
    type: 'varchar',
    length: 15,
    default: ResourceVisibility.SUBSCRIBERS,
  })
  visibility: ResourceVisibility;

  @Column({ name: 'required_tier_id', type: 'uuid', nullable: true })
  requiredTierId: string | null;

  @Column({ name: 'download_count', type: 'int', default: 0 })
  downloadCount: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
