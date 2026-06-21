import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityRoomMessages1833000000000 implements MigrationInterface {
  name = 'CommunityRoomMessages1833000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "community_challenge_participants"
      ADD COLUMN IF NOT EXISTS "progress_percent" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "community_challenge_participants"
      ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_room_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "room_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "body" character varying(2000) NOT NULL,
        "parent_message_id" uuid,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_room_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_room_messages_room" FOREIGN KEY ("room_id") REFERENCES "community_rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_room_messages_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_room_messages_room_created"
      ON "community_room_messages" ("room_id", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_room_messages_parent"
      ON "community_room_messages" ("room_id", "parent_message_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_room_permissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "room_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "permission" character varying(64) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_room_permissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_room_permissions_room" FOREIGN KEY ("room_id") REFERENCES "community_rooms"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_room_permissions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_room_permissions" UNIQUE ("room_id", "user_id", "permission")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_room_permissions_room"
      ON "community_room_permissions" ("room_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "creator_audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creator_id" uuid NOT NULL,
        "actor_id" uuid NOT NULL,
        "action" character varying(128) NOT NULL,
        "resource_type" character varying(64),
        "resource_id" uuid,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_creator_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_creator_audit_logs_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_creator_audit_logs_creator_created"
      ON "creator_audit_logs" ("creator_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "creator_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_room_permissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_room_messages"`);
    await queryRunner.query(`
      ALTER TABLE "community_challenge_participants" DROP COLUMN IF EXISTS "completed_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "community_challenge_participants" DROP COLUMN IF EXISTS "progress_percent"
    `);
  }
}
