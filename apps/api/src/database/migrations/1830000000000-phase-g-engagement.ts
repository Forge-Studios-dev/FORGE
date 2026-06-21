import { MigrationInterface, QueryRunner } from 'typeorm';

export class PhaseGEngagement1830000000000 implements MigrationInterface {
  name = 'PhaseGEngagement1830000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_wiki_pages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "slug" character varying(128) NOT NULL,
        "title" character varying(255) NOT NULL,
        "body" text NOT NULL DEFAULT '',
        "author_id" uuid NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_wiki_pages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_wiki_pages_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_wiki_pages_slug" UNIQUE ("community_id", "slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_wiki_pages_community"
      ON "community_wiki_pages" ("community_id", "sort_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_challenges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "starts_at" TIMESTAMPTZ,
        "ends_at" TIMESTAMPTZ,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_challenges_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_challenges_community"
      ON "community_challenges" ("community_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_challenge_participants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "challenge_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_challenge_participants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_challenge_participants_challenge" FOREIGN KEY ("challenge_id") REFERENCES "community_challenges"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_challenge_participants" UNIQUE ("challenge_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_surveys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "questions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "closes_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_surveys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_surveys_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_survey_responses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "survey_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "answers" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_survey_responses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_survey_responses_survey" FOREIGN KEY ("survey_id") REFERENCES "community_surveys"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_survey_responses" UNIQUE ("survey_id", "user_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "community_survey_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_surveys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_challenge_participants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_challenges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_wiki_pages"`);
  }
}
