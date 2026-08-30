import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * account_strikes.source_video_id had no FK — hard-deleting a video left dangling
 * UUIDs. Mirror copyright_notices: ON DELETE SET NULL so the strike audit row
 * survives and only the video link clears.
 */
export class AccountStrikesSourceVideoFk2270000000000 implements MigrationInterface {
  name = 'AccountStrikesSourceVideoFk2270000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "account_strikes" AS s
      SET "source_video_id" = NULL
      WHERE s."source_video_id" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "videos" v WHERE v."id" = s."source_video_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "account_strikes" DROP CONSTRAINT IF EXISTS "account_strikes_source_video_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "account_strikes"
      ADD CONSTRAINT "account_strikes_source_video_id_fkey"
      FOREIGN KEY ("source_video_id") REFERENCES "videos"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "account_strikes" DROP CONSTRAINT IF EXISTS "account_strikes_source_video_id_fkey"
    `);
  }
}
