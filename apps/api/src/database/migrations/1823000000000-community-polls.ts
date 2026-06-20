import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityPolls1823000000000 implements MigrationInterface {
  name = 'CommunityPolls1823000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_polls" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "question" character varying(500) NOT NULL,
        "options" jsonb NOT NULL DEFAULT '[]',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by_user_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "closed_at" TIMESTAMPTZ,
        CONSTRAINT "PK_community_polls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_polls_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_polls_author" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_community_polls_active" ON "community_polls" ("community_id", "is_active")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_poll_votes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "poll_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "option_index" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_poll_votes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_poll_votes_poll" FOREIGN KEY ("poll_id") REFERENCES "community_polls"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_poll_votes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_poll_votes_poll_user" UNIQUE ("poll_id", "user_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "community_poll_votes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_polls"`);
  }
}
