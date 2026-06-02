import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoMuxVodColumns1746000000000 implements MigrationInterface {
  name = 'VideoMuxVodColumns1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'videos_transcode_provider_enum') THEN
          CREATE TYPE "videos_transcode_provider_enum" AS ENUM ('ffmpeg', 'mux');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "mux_asset_id" character varying,
      ADD COLUMN IF NOT EXISTS "mux_playback_id" character varying,
      ADD COLUMN IF NOT EXISTS "transcode_provider" "videos_transcode_provider_enum";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      DROP COLUMN IF EXISTS "transcode_provider",
      DROP COLUMN IF EXISTS "mux_playback_id",
      DROP COLUMN IF EXISTS "mux_asset_id";
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'videos_transcode_provider_enum') THEN
          DROP TYPE "videos_transcode_provider_enum";
        END IF;
      END$$;
    `);
  }
}
