import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('courses')
@Index(['creatorId'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 100 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_published', default: false })
  isPublished: boolean;

  @Column({ name: 'community_id', type: 'uuid', nullable: true })
  communityId: string | null;

  /** 0 = not sold standalone (access via community/tier entitlement instead). */
  @Column({ name: 'price_cents', type: 'int', default: 0 })
  priceCents: number;

  /** Stripe price ID for one-time purchase, when priceCents > 0. */
  @Column({ name: 'stripe_price_id', type: 'varchar', nullable: true, length: 100 })
  stripePriceId: string | null;

  /** True when this course is a bundle wrapper — its content is other courses
   *  (via CourseBundleItem) rather than its own lessons. Formerly a separate
   *  CreatorProgram row; see migration 1839800000000-merge-programs-into-courses. */
  @Column({ name: 'is_bundle', default: false })
  isBundle: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('course_bundle_items')
@Index(['bundleCourseId'])
export class CourseBundleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bundle_course_id', type: 'uuid' })
  bundleCourseId: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bundle_course_id' })
  bundleCourse: Course;

  @Column({ name: 'item_course_id', type: 'uuid' })
  itemCourseId: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_course_id' })
  itemCourse: Course;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}

@Entity('course_cohorts')
@Index(['courseId'])
export class CourseCohort {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ length: 200 })
  name: string;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'community_id', type: 'uuid', nullable: true })
  communityId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
