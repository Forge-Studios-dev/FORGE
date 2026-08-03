import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoCaptionTracks1900000000000 implements MigrationInterface {
  name = 'VideoCaptionTracks1900000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "caption_tracks" jsonb
    `);
    // Backfill single-track English from legacy caption_url
    await queryRunner.query(`
      UPDATE "videos"
      SET "caption_tracks" = jsonb_build_array(
        jsonb_build_object(
          'language', 'en',
          'label', 'English',
          'url', "caption_url"
        )
      )
      WHERE "caption_url" IS NOT NULL
        AND ("caption_tracks" IS NULL OR "caption_tracks" = 'null'::jsonb)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      DROP COLUMN IF EXISTS "caption_tracks"
    `);
  }
}
