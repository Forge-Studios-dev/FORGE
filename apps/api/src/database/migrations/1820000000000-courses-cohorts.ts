import { MigrationInterface, QueryRunner } from 'typeorm';

export class CoursesCohorts1820000000000 implements MigrationInterface {
  name = 'CoursesCohorts1820000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "courses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creator_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "description" text,
        "is_published" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_courses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_courses_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_courses_creator_slug" UNIQUE ("creator_id", "slug")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "course_cohorts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "course_id" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "starts_at" TIMESTAMPTZ,
        "ends_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_course_cohorts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_course_cohorts_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "course_cohorts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courses"`);
  }
}
