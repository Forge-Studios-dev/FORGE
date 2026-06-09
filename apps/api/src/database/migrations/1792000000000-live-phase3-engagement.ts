import { MigrationInterface, QueryRunner } from 'typeorm';

export class LivePhase3Engagement1792000000000 implements MigrationInterface {
  name = 'LivePhase3Engagement1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_moderators" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "stream_id" uuid NOT NULL REFERENCES "streams"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "granted_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stream_moderators_stream_user"
      ON "stream_moderators" ("stream_id", "user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_rsvps" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "stream_id" uuid NOT NULL REFERENCES "streams"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stream_rsvps_stream_user"
      ON "stream_rsvps" ("stream_id", "user_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_polls" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "stream_id" uuid NOT NULL REFERENCES "streams"("id") ON DELETE CASCADE,
        "question" varchar(500) NOT NULL,
        "options" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "closed_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stream_polls_stream_active"
      ON "stream_polls" ("stream_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_poll_votes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "poll_id" uuid NOT NULL REFERENCES "stream_polls"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "option_index" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stream_poll_votes_poll_user"
      ON "stream_poll_votes" ("poll_id", "user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_poll_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_polls"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_rsvps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_moderators"`);
  }
}
