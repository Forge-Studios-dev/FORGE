import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveSubsCommunity1750000000000 implements MigrationInterface {
  name = 'LiveSubsCommunity1750000000000';

  /** Enum ADD VALUE and large DDL must not run inside a single PG transaction. */
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_tiers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creator_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "price_cents" integer NOT NULL DEFAULT 0,
        "currency" character varying(3) NOT NULL DEFAULT 'INR',
        "benefits" jsonb NOT NULL DEFAULT '[]',
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_tiers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscription_tiers_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_subscription_tiers_creator_slug" UNIQUE ("creator_id", "slug")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscription_tiers_creator" ON "subscription_tiers" ("creator_id")`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."member_subscriptions_status_enum" AS ENUM ('active', 'canceled', 'expired');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."member_subscriptions_source_enum" AS ENUM ('mock', 'admin_grant', 'payment');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "member_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "creator_id" uuid NOT NULL,
        "tier_id" uuid NOT NULL,
        "status" "public"."member_subscriptions_status_enum" NOT NULL DEFAULT 'active',
        "source" "public"."member_subscriptions_source_enum" NOT NULL DEFAULT 'mock',
        "starts_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "expires_at" TIMESTAMPTZ,
        "external_ref" character varying(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_member_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_member_subscriptions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_member_subscriptions_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_member_subscriptions_tier" FOREIGN KEY ("tier_id") REFERENCES "subscription_tiers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_member_subscriptions_user_creator" ON "member_subscriptions" ("user_id", "creator_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_member_subscriptions_creator_status" ON "member_subscriptions" ("creator_id", "status")`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."streams_visibility_enum" AS ENUM ('public', 'followers', 'subscribers', 'tier', 'private', 'paid_event');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "streams"
        ADD COLUMN IF NOT EXISTS "visibility" "public"."streams_visibility_enum" NOT NULL DEFAULT 'public',
        ADD COLUMN IF NOT EXISTS "category_id" uuid,
        ADD COLUMN IF NOT EXISTS "chat_enabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "record_enabled" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "age_restricted" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "required_tier_id" uuid,
        ADD COLUMN IF NOT EXISTS "slow_mode_seconds" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "ticket_price_cents" integer
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "streams"
          ADD CONSTRAINT "FK_streams_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "streams"
          ADD CONSTRAINT "FK_streams_required_tier" FOREIGN KEY ("required_tier_id") REFERENCES "subscription_tiers"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."videos_visibility_enum" ADD VALUE IF NOT EXISTS 'followers';
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."videos_visibility_enum" ADD VALUE IF NOT EXISTS 'subscribers';
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."videos_visibility_enum" ADD VALUE IF NOT EXISTS 'tier';
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."videos_visibility_enum" ADD VALUE IF NOT EXISTS 'paid_event';
    `);

    await queryRunner.query(`
      ALTER TABLE "videos"
        ADD COLUMN IF NOT EXISTS "required_tier_id" uuid,
        ADD COLUMN IF NOT EXISTS "source_stream_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "videos"
          ADD CONSTRAINT "FK_videos_required_tier" FOREIGN KEY ("required_tier_id") REFERENCES "subscription_tiers"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "videos"
          ADD CONSTRAINT "FK_videos_source_stream" FOREIGN KEY ("source_stream_id") REFERENCES "streams"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "communities" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creator_id" uuid NOT NULL,
        "name" character varying(200) NOT NULL DEFAULT 'Community',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_communities" PRIMARY KEY ("id"),
        CONSTRAINT "FK_communities_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_communities_creator" UNIQUE ("creator_id")
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."channels_type_enum" AS ENUM ('public', 'subscribers', 'tier', 'invite');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channels" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "type" "public"."channels_type_enum" NOT NULL DEFAULT 'public',
        "required_tier_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channels" PRIMARY KEY ("id"),
        CONSTRAINT "FK_channels_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_channels_community_slug" UNIQUE ("community_id", "slug")
      )
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "channels"
          ADD CONSTRAINT "FK_channels_required_tier" FOREIGN KEY ("required_tier_id") REFERENCES "subscription_tiers"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channel_members" (
        "channel_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_members" PRIMARY KEY ("channel_id", "user_id"),
        CONSTRAINT "FK_channel_members_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_channel_members_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channel_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "channel_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "body" character varying(2000) NOT NULL,
        "parent_id" uuid,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_channel_messages_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_channel_messages_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_channel_messages_channel_created" ON "channel_messages" ("channel_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "stream_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "body" character varying(500) NOT NULL,
        "parent_id" uuid,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stream_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stream_messages_stream" FOREIGN KEY ("stream_id") REFERENCES "streams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stream_messages_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stream_messages_stream_created" ON "stream_messages" ("stream_id", "created_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_moderation_actions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "stream_id" uuid NOT NULL,
        "target_user_id" uuid NOT NULL,
        "action" character varying(32) NOT NULL,
        "expires_at" TIMESTAMPTZ,
        "created_by_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stream_moderation_actions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stream_mod_stream" FOREIGN KEY ("stream_id") REFERENCES "streams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stream_mod_target" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stream_mod_creator" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_stream_mod_stream_target" ON "stream_moderation_actions" ("stream_id", "target_user_id")`,
    );

    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'stream_started_followed';
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'premium_content_new';
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'subscription_expiring';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_moderation_actions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channel_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channel_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "communities"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "source_stream_id"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "required_tier_id"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "ticket_price_cents"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "scheduled_at"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "slow_mode_seconds"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "required_tier_id"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "age_restricted"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "record_enabled"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "chat_enabled"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "category_id"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "visibility"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "member_subscriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_tiers"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "member_subscriptions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "member_subscriptions_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "streams_visibility_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "channels_type_enum"`);
  }
}
