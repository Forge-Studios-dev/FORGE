import { MigrationInterface, QueryRunner } from 'typeorm';

export class CourseLessonVideo1838000000000 implements MigrationInterface {
  name = 'CourseLessonVideo1838000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE course_lessons
        ADD COLUMN IF NOT EXISTS lesson_type VARCHAR(10) NOT NULL DEFAULT 'text'
          CHECK (lesson_type IN ('text', 'video')),
        ADD COLUMN IF NOT EXISTS video_id UUID NULL
          REFERENCES videos(id) ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_course_lessons_video_id ON course_lessons(video_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_course_lessons_video_id`,
    );
    await queryRunner.query(`
      ALTER TABLE course_lessons
        DROP COLUMN IF EXISTS video_id,
        DROP COLUMN IF EXISTS lesson_type
    `);
  }
}
