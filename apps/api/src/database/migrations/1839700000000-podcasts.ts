import { MigrationInterface, QueryRunner } from 'typeorm';

export class Podcasts1839700000000 implements MigrationInterface {
  name = 'Podcasts1839700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS podcast_series (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        cover_image_url TEXT,
        category TEXT,
        language TEXT,
        rss_enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_podcast_series_user ON podcast_series(user_id)`,
    );

    // Extend videos for podcast episodes
    await queryRunner.query(
      `ALTER TABLE videos ADD COLUMN IF NOT EXISTS podcast_series_id UUID REFERENCES podcast_series(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE videos ADD COLUMN IF NOT EXISTS episode_number INTEGER`,
    );
    await queryRunner.query(
      `ALTER TABLE videos ADD COLUMN IF NOT EXISTS season INTEGER`,
    );
    await queryRunner.query(
      `ALTER TABLE videos ADD COLUMN IF NOT EXISTS show_notes TEXT`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_videos_podcast_series ON videos(podcast_series_id) WHERE podcast_series_id IS NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE videos DROP COLUMN IF EXISTS show_notes`);
    await queryRunner.query(`ALTER TABLE videos DROP COLUMN IF EXISTS season`);
    await queryRunner.query(`ALTER TABLE videos DROP COLUMN IF EXISTS episode_number`);
    await queryRunner.query(`ALTER TABLE videos DROP COLUMN IF EXISTS podcast_series_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS podcast_series`);
  }
}
