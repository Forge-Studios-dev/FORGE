import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Community } from '../../communities/entities/community.entity';

@Entity('creator_programs')
@Index(['creatorId', 'isPublished', 'sortOrder'])
export class CreatorProgram {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 120 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'community_id', type: 'uuid', nullable: true })
  communityId: string | null;

  @ManyToOne(() => Community, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'community_id' })
  community: Community | null;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  /** 0 = free; positive = price in cents (USD). */
  @Column({ name: 'price_cents', type: 'int', default: 0 })
  priceCents: number;

  /** Stripe price ID when sold as a one-time purchase (null until configured). */
  @Column({ name: 'stripe_price_id', type: 'varchar', nullable: true, length: 100 })
  stripePriceId: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => CreatorProgramCourse, (row) => row.program, { cascade: true })
  courses: CreatorProgramCourse[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('creator_program_courses')
@Index(['programId', 'sortOrder'])
export class CreatorProgramCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'program_id', type: 'uuid' })
  programId: string;

  @ManyToOne(() => CreatorProgram, (program) => program.courses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'program_id' })
  program: CreatorProgram;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
