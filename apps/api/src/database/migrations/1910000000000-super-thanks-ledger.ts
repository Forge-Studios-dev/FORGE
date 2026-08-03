import { MigrationInterface, QueryRunner } from 'typeorm';

export class SuperThanksLedger1910000000000 implements MigrationInterface {
  name = 'SuperThanksLedger1910000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "super_thanks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "video_id" uuid NOT NULL,
        "creator_id" uuid NOT NULL,
        "tipper_id" uuid NOT NULL,
        "amount_cents" integer NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'usd',
        "body" character varying(200),
        "stripe_checkout_session_id" character varying,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_super_thanks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_super_thanks_stripe_session" UNIQUE ("stripe_checkout_session_id"),
        CONSTRAINT "FK_super_thanks_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_super_thanks_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_super_thanks_tipper" FOREIGN KEY ("tipper_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_super_thanks_creator_created"
      ON "super_thanks" ("creator_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_super_thanks_video_created"
      ON "super_thanks" ("video_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_super_thanks_video_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_super_thanks_creator_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "super_thanks"`);
  }
}
