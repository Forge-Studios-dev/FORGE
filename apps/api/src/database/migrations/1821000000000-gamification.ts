import { MigrationInterface, QueryRunner } from 'typeorm';

export class Gamification1821000000000 implements MigrationInterface {
  name = 'Gamification1821000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "member_xp" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "community_id" uuid NOT NULL,
        "xp" integer NOT NULL DEFAULT 0,
        "level" integer NOT NULL DEFAULT 1,
        "streak" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_member_xp" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_member_xp_user_community" UNIQUE ("user_id", "community_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "member_badges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "badge_key" character varying(64) NOT NULL,
        "community_id" uuid,
        "awarded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_member_badges" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "member_badges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "member_xp"`);
  }
}
