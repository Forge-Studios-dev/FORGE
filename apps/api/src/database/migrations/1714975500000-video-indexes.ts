import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoIndexes1714975500000 implements MigrationInterface {
  name = 'VideoIndexes1714975500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_videos_user_created_at" ON "videos" ("user_id", "created_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_videos_status_created_at" ON "videos" ("status", "created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_videos_status_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_videos_user_created_at"`);
  }
}

