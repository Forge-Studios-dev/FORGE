import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum QuizQuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
}

export enum AssignmentSubmissionStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  GRADED = 'graded',
}

@Entity('course_quizzes')
@Index(['courseId'])
@Index(['lessonId'])
export class CourseQuiz {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string | null;

  @Column({ length: 200 })
  title: string;

  /** JSONB: Array of { question: string; type: QuizQuestionType; options?: string[]; correctAnswer: string | number } */
  @Column({ type: 'jsonb', default: [] })
  questions: Array<{
    question: string;
    type: QuizQuestionType;
    options?: string[];
    correctAnswer: string | number;
  }>;

  @Column({ name: 'passing_score', type: 'int', default: 70 })
  passingScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('course_quiz_attempts')
@Index(['quizId', 'userId'])
export class CourseQuizAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** JSONB: Array of user answers (string | number) indexed to match quiz.questions */
  @Column({ type: 'jsonb', default: [] })
  answers: Array<string | number>;

  @Column({ name: 'score_percent', type: 'int', default: 0 })
  scorePercent: number;

  @Column({ default: false })
  passed: boolean;

  @CreateDateColumn({ name: 'attempted_at' })
  attemptedAt: Date;
}

/** Creator-defined assignment/challenge (open-ended, graded by creator). */
@Entity('course_assignments')
@Index(['courseId'])
export class CourseAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string | null;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  instructions: string;

  @Column({ name: 'due_days', type: 'int', nullable: true })
  dueDays: number | null;

  @Column({ name: 'max_score', type: 'int', default: 100 })
  maxScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('course_assignment_submissions')
@Index(['assignmentId', 'userId'], { unique: true })
export class CourseAssignmentSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'file_urls', type: 'jsonb', default: [] })
  fileUrls: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: AssignmentSubmissionStatus.SUBMITTED,
  })
  status: AssignmentSubmissionStatus;

  @Column({ name: 'grade', type: 'int', nullable: true })
  grade: number | null;

  @Column({ name: 'feedback', type: 'text', nullable: true })
  feedback: string | null;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
