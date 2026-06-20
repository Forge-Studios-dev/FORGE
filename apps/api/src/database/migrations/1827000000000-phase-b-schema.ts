import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseBSchema1827000000000 implements MigrationInterface {
  name = 'PhaseBSchema1827000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_lessons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "content" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "duration_minutes" integer,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_lessons" PRIMARY KEY ("id"),
        CONSTRAINT "FK_course_lessons_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_course_lessons_course_slug" UNIQUE ("course_id", "slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_course_lessons_course" ON "course_lessons" ("course_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_enrollments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "cohort_id" uuid,
        "enrolled_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_enrollments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_course_enrollments_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_course_enrollments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_course_enrollments_cohort" FOREIGN KEY ("cohort_id") REFERENCES "course_cohorts"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_course_enrollments_user_course" UNIQUE ("user_id", "course_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_lesson_progress" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "enrollment_id" uuid NOT NULL,
        "lesson_id" uuid NOT NULL,
        "completed_at" TIMESTAMPTZ,
        "progress_percent" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_lesson_progress" PRIMARY KEY ("id"),
        CONSTRAINT "FK_lesson_progress_enrollment" FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_progress_lesson" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_lesson_progress_enrollment_lesson" UNIQUE ("enrollment_id", "lesson_id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "member_xp"
      ADD COLUMN IF NOT EXISTS "last_check_in_at" date
    `);

    await queryRunner.query(`
      ALTER TABLE "streams"
      ADD COLUMN IF NOT EXISTS "community_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_streams_community" ON "streams" ("community_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_streams_community"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "community_id"`);
    await queryRunner.query(`ALTER TABLE "member_xp" DROP COLUMN IF EXISTS "last_check_in_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_lesson_progress"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_enrollments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "course_lessons"`);
  }
}
