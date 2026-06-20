import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseDSchema1829000000000 implements MigrationInterface {
  name = 'PhaseDSchema1829000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "community_posts"
      ADD COLUMN IF NOT EXISTS "media_urls" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_event_outbox" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_type" character varying(128) NOT NULL,
        "payload" jsonb NOT NULL,
        "idempotency_key" character varying(255),
        "status" character varying(32) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMPTZ,
        CONSTRAINT "PK_platform_event_outbox" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_platform_event_outbox_idempotency"
      ON "platform_event_outbox" ("idempotency_key")
      WHERE "idempotency_key" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_platform_event_outbox_status_created"
      ON "platform_event_outbox" ("status", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_event_outbox"`);
    await queryRunner.query(`
      ALTER TABLE "community_posts" DROP COLUMN IF EXISTS "media_urls"
    `);
  }
}
