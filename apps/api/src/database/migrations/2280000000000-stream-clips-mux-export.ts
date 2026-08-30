import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mux highlight-clip export fields on stream_clips (LIVE.md deferred export job).
 * Markers stay row-backed; export fills mux_clip_asset_id + playback_url asynchronously.
 */
export class StreamClipsMuxExport2280000000000 implements MigrationInterface {
  name = 'StreamClipsMuxExport2280000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stream_clips"
        ADD COLUMN IF NOT EXISTS "mux_clip_asset_id" varchar(64),
        ADD COLUMN IF NOT EXISTS "playback_url" text,
        ADD COLUMN IF NOT EXISTS "export_error" text
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stream_clips_mux_clip_asset"
      ON "stream_clips" ("mux_clip_asset_id")
      WHERE "mux_clip_asset_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stream_clips_mux_clip_asset"`);
    await queryRunner.query(`
      ALTER TABLE "stream_clips"
        DROP COLUMN IF EXISTS "export_error",
        DROP COLUMN IF EXISTS "playback_url",
        DROP COLUMN IF EXISTS "mux_clip_asset_id"
    `);
  }
}
