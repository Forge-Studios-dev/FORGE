import { MigrationInterface, QueryRunner } from 'typeorm';

export class CopyrightAndStrikes2100000000000 implements MigrationInterface {
  name = 'CopyrightAndStrikes2100000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "upload_restricted_until" timestamptz NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_strikes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" varchar(32) NOT NULL,
        "reason" varchar(1000) NOT NULL,
        "source_video_id" uuid NULL,
        "source_report_id" uuid NULL,
        "consequence" varchar(32) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'active',
        "appeal_status" varchar(16) NOT NULL DEFAULT 'none',
        "appeal_reason" varchar(2000) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NULL,
        "resolved_at" timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_account_strikes_user_type_status"
      ON "account_strikes" ("user_id", "type", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "copyright_notices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "video_id" uuid NOT NULL REFERENCES "videos"("id") ON DELETE CASCADE,
        "claimant_name" varchar(300) NOT NULL,
        "claimant_email" varchar(300) NOT NULL,
        "claimant_address" varchar(1000) NOT NULL,
        "work_description" varchar(2000) NOT NULL,
        "infringing_description" varchar(2000) NOT NULL,
        "good_faith_statement" boolean NOT NULL,
        "accuracy_statement" boolean NOT NULL,
        "signature" varchar(300) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'pending',
        "previous_visibility" varchar(32) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "resolved_at" timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copyright_notices_video_id" ON "copyright_notices" ("video_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copyright_notices_status" ON "copyright_notices" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "copyright_counter_notices" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "notice_id" uuid NOT NULL REFERENCES "copyright_notices"("id") ON DELETE CASCADE,
        "uploader_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "contact_info" varchar(1000) NOT NULL,
        "good_faith_mistake_statement" boolean NOT NULL,
        "consent_to_jurisdiction" boolean NOT NULL,
        "signature" varchar(300) NOT NULL,
        "status" varchar(16) NOT NULL DEFAULT 'pending',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "reinstate_eligible_at" timestamptz NOT NULL,
        "resolved_at" timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copyright_counter_notices_notice_id"
      ON "copyright_counter_notices" ("notice_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_copyright_counter_notices_status_reinstate"
      ON "copyright_counter_notices" ("status", "reinstate_eligible_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "copyright_counter_notices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "copyright_notices"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account_strikes"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "upload_restricted_until"`);
  }
}
