import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelToRoomBackfill1837100000000 implements MigrationInterface {
  name = 'ChannelToRoomBackfill1837100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channel_room_mappings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "channel_id" uuid NOT NULL,
        "room_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_room_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_channel_room_mappings_channel" UNIQUE ("channel_id"),
        CONSTRAINT "UQ_channel_room_mappings_room" UNIQUE ("room_id"),
        CONSTRAINT "FK_channel_room_mappings_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_channel_room_mappings_room" FOREIGN KEY ("room_id") REFERENCES "community_rooms"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      INSERT INTO "community_rooms" (
        "community_id", "name", "slug", "room_type", "category_id", "sort_order", "settings", "is_active"
      )
      SELECT
        ch."community_id",
        ch."name",
        ch."slug",
        'text',
        ch."category_id",
        ch."sort_order",
        CASE
          WHEN ch."required_tier_id" IS NOT NULL THEN jsonb_build_object(
            'requiredTierId', ch."required_tier_id"::text,
            'migratedFromChannelId', ch."id"::text
          )
          ELSE jsonb_build_object('migratedFromChannelId', ch."id"::text)
        END,
        true
      FROM "channels" ch
      WHERE NOT EXISTS (
        SELECT 1 FROM "channel_room_mappings" m WHERE m."channel_id" = ch."id"
      )
      AND NOT EXISTS (
        SELECT 1 FROM "community_rooms" r
        WHERE r."community_id" = ch."community_id" AND r."slug" = ch."slug"
      )
    `);

    await queryRunner.query(`
      INSERT INTO "channel_room_mappings" ("channel_id", "room_id")
      SELECT ch."id", r."id"
      FROM "channels" ch
      INNER JOIN "community_rooms" r
        ON r."community_id" = ch."community_id" AND r."slug" = ch."slug"
      WHERE NOT EXISTS (
        SELECT 1 FROM "channel_room_mappings" m WHERE m."channel_id" = ch."id"
      )
    `);

    await queryRunner.query(`
      INSERT INTO "community_room_messages" (
        "room_id", "user_id", "body", "parent_message_id", "deleted_at", "created_at"
      )
      SELECT
        m."room_id",
        cm."user_id",
        cm."body",
        NULL,
        cm."deleted_at",
        cm."created_at"
      FROM "channel_messages" cm
      INNER JOIN "channel_room_mappings" m ON m."channel_id" = cm."channel_id"
      WHERE NOT EXISTS (
        SELECT 1 FROM "community_room_messages" rm
        WHERE rm."room_id" = m."room_id"
          AND rm."user_id" = cm."user_id"
          AND rm."body" = cm."body"
          AND rm."created_at" = cm."created_at"
      )
      AND cm."parent_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "courses"
      ADD COLUMN IF NOT EXISTS "community_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "communities"
      ADD COLUMN IF NOT EXISTS "community_type" character varying(32) DEFAULT 'standard'
    `);
    await queryRunner.query(`
      ALTER TABLE "communities"
      ADD COLUMN IF NOT EXISTS "linked_course_id" uuid
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "creator_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "description" text,
        "starts_at" TIMESTAMPTZ NOT NULL,
        "ends_at" TIMESTAMPTZ,
        "location" character varying(500),
        "is_online" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_events_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_community_events_community_starts"
      ON "community_events" ("community_id", "starts_at")
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_event_rsvps" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'going',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_event_rsvps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_community_event_rsvp" UNIQUE ("event_id", "user_id"),
        CONSTRAINT "FK_community_event_rsvps_event" FOREIGN KEY ("event_id") REFERENCES "community_events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_event_rsvps_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "community_event_rsvps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_events"`);
    await queryRunner.query(`ALTER TABLE "communities" DROP COLUMN IF EXISTS "linked_course_id"`);
    await queryRunner.query(`ALTER TABLE "communities" DROP COLUMN IF EXISTS "community_type"`);
    await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN IF EXISTS "community_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channel_room_mappings"`);
  }
}
