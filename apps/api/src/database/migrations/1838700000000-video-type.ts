import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoType1838700000000 implements MigrationInterface {
  name = 'VideoType1838700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE videos
        ADD COLUMN IF NOT EXISTS video_type VARCHAR(10) NOT NULL DEFAULT 'video'
          CHECK (video_type IN ('video', 'short'))
    `);
    // Auto-classify existing videos with known duration <= 60s as shorts.
    await queryRunner.query(`
      UPDATE videos SET video_type = 'short'
      WHERE duration_seconds IS NOT NULL AND duration_seconds <= 60
        AND status = 'ready'
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_videos_type ON videos(video_type) WHERE video_type = 'short'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_videos_type`);
    await queryRunner.query(`ALTER TABLE videos DROP COLUMN IF EXISTS video_type`);
  }
}
