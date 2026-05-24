import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoMultipartSessions1741000000000 implements MigrationInterface {
  name = 'VideoMultipartSessions1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "video_multipart_sessions" (
        "video_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "state" jsonb NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_video_multipart_sessions" PRIMARY KEY ("video_id"),
        CONSTRAINT "FK_video_multipart_sessions_video"
          FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_video_multipart_sessions_expires_at" ON "video_multipart_sessions" ("expires_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_video_multipart_sessions_user_id" ON "video_multipart_sessions" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "video_multipart_sessions"`);
  }
}
