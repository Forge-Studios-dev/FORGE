import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityRooms1832000000000 implements MigrationInterface {
  name = 'CommunityRooms1832000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_rooms" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "slug" character varying(120) NOT NULL,
        "room_type" character varying(32) NOT NULL DEFAULT 'text',
        "description" text,
        "max_participants" integer,
        "is_active" boolean NOT NULL DEFAULT true,
        "settings" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_rooms" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_rooms_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_rooms_slug" UNIQUE ("community_id", "slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_rooms_community"
      ON "community_rooms" ("community_id", "is_active", "sort_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "community_rooms"`);
  }
}
