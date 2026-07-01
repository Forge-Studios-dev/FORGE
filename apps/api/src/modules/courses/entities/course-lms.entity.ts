import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum LessonType {
  TEXT = 'text',
  VIDEO = 'video',
}

@Entity('course_lessons')
@Index(['courseId'])
@Index(['videoId'])
export class CourseLesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 100 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({
    name: 'lesson_type',
    type: 'varchar',
    length: 10,
    default: LessonType.TEXT,
  })
  lessonType: LessonType;

  /** UUID of a Video asset (mux-ready) attached to this lesson. */
  @Column({ name: 'video_id', type: 'uuid', nullable: true })
  videoId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('course_enrollments')
@Index(['courseId', 'userId'], { unique: true })
export class CourseEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'cohort_id', type: 'uuid', nullable: true })
  cohortId: string | null;

  @CreateDateColumn({ name: 'enrolled_at' })
  enrolledAt: Date;
}

@Entity('course_lesson_progress')
@Index(['enrollmentId', 'lessonId'], { unique: true })
export class CourseLessonProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'enrollment_id', type: 'uuid' })
  enrollmentId: string;

  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'progress_percent', type: 'int', default: 0 })
  progressPercent: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** Issued when a learner completes 100% of a course's lessons. */
@Entity('course_certificates')
@Index(['courseId', 'userId'], { unique: true })
export class CourseCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Display name captured at issuance (user may change name later). */
  @Column({ name: 'recipient_name', length: 200 })
  recipientName: string;

  @Column({ name: 'course_title', length: 300 })
  courseTitle: string;

  @Column({ name: 'creator_name', length: 200 })
  creatorName: string;

  @CreateDateColumn({ name: 'issued_at' })
  issuedAt: Date;
}
