import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dedupe any race-created duplicate (user_id, video_id) rows, then ensure the
 * unique constraint exists before engagement.service relies on it for retries.
 */
export class LikesDedupeUnique2250000000000 implements MigrationInterface {
  name = 'LikesDedupeUnique2250000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM likes a
      USING likes b
      WHERE a.user_id = b.user_id
        AND a.video_id = b.video_id
        AND a.id > b.id
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'UQ_2c50d9d69c25c7de2f16e7a6205'
        ) THEN
          ALTER TABLE likes
            ADD CONSTRAINT "UQ_2c50d9d69c25c7de2f16e7a6205" UNIQUE (user_id, video_id);
        END IF;
      END $$;
    `);
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive: keep unique constraint in place on rollback.
  }
}
