import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoShares2070000000000 implements MigrationInterface {
  name = 'VideoShares2070000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "share_count" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shares" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "video_id" uuid NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
        "user_id" uuid NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "channel" varchar(32) NOT NULL DEFAULT 'other',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shares_video_id" ON "shares" ("video_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_shares_video_id_created_at" ON "shares" ("video_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shares"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "share_count"`);
  }
}
