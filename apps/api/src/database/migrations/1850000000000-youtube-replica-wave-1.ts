import { MigrationInterface, QueryRunner } from 'typeorm';

export class YoutubeReplicaWave11850000000000 implements MigrationInterface {
  name = 'YoutubeReplicaWave11850000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE likes
        ADD COLUMN IF NOT EXISTS reaction VARCHAR(10) NOT NULL DEFAULT 'like'
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE likes ADD CONSTRAINT likes_reaction_check
          CHECK (reaction IN ('like', 'dislike'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      ALTER TABLE videos
        ADD COLUMN IF NOT EXISTS dislike_count INT NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      ALTER TABLE playlists
        ADD COLUMN IF NOT EXISTS description VARCHAR(500) NULL,
        ADD COLUMN IF NOT EXISTS system_type VARCHAR(20) NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE playlists ADD CONSTRAINT playlists_system_type_check
          CHECK (system_type IS NULL OR system_type IN ('watch_later', 'liked'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_playlists_user_system_type
        ON playlists (user_id, system_type)
        WHERE system_type IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE playlist_videos
        ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_playlist_videos_position
        ON playlist_videos (playlist_id, position)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_playlist_videos_position`);
    await queryRunner.query(`ALTER TABLE playlist_videos DROP COLUMN IF EXISTS position`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_playlists_user_system_type`);
    await queryRunner.query(`ALTER TABLE playlists DROP CONSTRAINT IF EXISTS playlists_system_type_check`);
    await queryRunner.query(`
      ALTER TABLE playlists
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS system_type
    `);
    await queryRunner.query(`ALTER TABLE videos DROP COLUMN IF EXISTS dislike_count`);
    await queryRunner.query(`ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_reaction_check`);
    await queryRunner.query(`ALTER TABLE likes DROP COLUMN IF EXISTS reaction`);
  }
}
