import { MigrationInterface, QueryRunner } from 'typeorm';

export class Community2Schema1800000000000 implements MigrationInterface {
  name = 'Community2Schema1800000000000';

  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "brands" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creator_id" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_brands" PRIMARY KEY ("id"),
        CONSTRAINT "FK_brands_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_brands_creator_slug" UNIQUE ("creator_id", "slug")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_brands_creator" ON "brands" ("creator_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "communities" DROP CONSTRAINT IF EXISTS "UQ_communities_creator"
    `);
    await queryRunner.query(`
      ALTER TABLE "communities"
        ADD COLUMN IF NOT EXISTS "slug" character varying(100),
        ADD COLUMN IF NOT EXISTS "visibility" character varying(32) NOT NULL DEFAULT 'public',
        ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "brand_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "communities" SET "slug" = 'community' WHERE "slug" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "communities" ALTER COLUMN "slug" SET NOT NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "communities"
          ADD CONSTRAINT "FK_communities_brand" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_communities_creator_slug"
        ON "communities" ("creator_id", "slug")
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_communities_creator" ON "communities" ("creator_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_categories" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_categories_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_categories_community_slug" UNIQUE ("community_id", "slug")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_community_categories_community" ON "community_categories" ("community_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "channels"
        ADD COLUMN IF NOT EXISTS "category_id" uuid
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "channels"
          ADD CONSTRAINT "FK_channels_category" FOREIGN KEY ("category_id") REFERENCES "community_categories"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    const newStatuses = [
      'trial',
      'grace_period',
      'paused',
      'renewal_pending',
      'failed_payment',
      'suspended',
      'refunded',
    ];
    for (const status of newStatuses) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "public"."member_subscriptions_status_enum" ADD VALUE IF NOT EXISTS '${status}';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
        ADD COLUMN IF NOT EXISTS "stripe_product_id" character varying(255),
        ADD COLUMN IF NOT EXISTS "stripe_price_id" character varying(255),
        ADD COLUMN IF NOT EXISTS "billing_interval" character varying(32) NOT NULL DEFAULT 'monthly',
        ADD COLUMN IF NOT EXISTS "trial_days" integer NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tier_entitlements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tier_id" uuid NOT NULL,
        "resource_type" character varying(64) NOT NULL,
        "resource_id" uuid,
        "access_level" character varying(64) NOT NULL DEFAULT 'full',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tier_entitlements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tier_entitlements_tier" FOREIGN KEY ("tier_id") REFERENCES "subscription_tiers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tier_entitlements_tier" ON "tier_entitlements" ("tier_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tier_entitlements_resource" ON "tier_entitlements" ("resource_type", "resource_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_roles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role" character varying(32) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_roles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_roles_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_roles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_roles_community_user" UNIQUE ("community_id", "user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_community_roles_community" ON "community_roles" ("community_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_member_bans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "reason" character varying(500),
        "expires_at" TIMESTAMPTZ,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_member_bans" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_member_bans_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_member_bans_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_member_bans_community_user" UNIQUE ("community_id", "user_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "channel_id" uuid,
        "message_id" uuid,
        "reporter_id" uuid NOT NULL,
        "reason" character varying(500) NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'open',
        "resolved_by" uuid,
        "resolved_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_reports_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_community_reports_status" ON "community_reports" ("status", "created_at" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "access_session_audit" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "session_type" character varying(32) NOT NULL,
        "resource_id" uuid,
        "device_fingerprint" character varying(255),
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "ended_at" TIMESTAMPTZ,
        "ended_reason" character varying(64),
        CONSTRAINT "PK_access_session_audit" PRIMARY KEY ("id"),
        CONSTRAINT "FK_access_session_audit_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_access_session_audit_user" ON "access_session_audit" ("user_id", "started_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "access_session_audit"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_member_bans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tier_entitlements"`);
    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
        DROP COLUMN IF EXISTS "trial_days",
        DROP COLUMN IF EXISTS "billing_interval",
        DROP COLUMN IF EXISTS "stripe_price_id",
        DROP COLUMN IF EXISTS "stripe_product_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "channels" DROP CONSTRAINT IF EXISTS "FK_channels_category"
    `);
    await queryRunner.query(`ALTER TABLE "channels" DROP COLUMN IF EXISTS "category_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_categories"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_communities_creator_slug"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_communities_creator"`);
    await queryRunner.query(`
      ALTER TABLE "communities"
        DROP CONSTRAINT IF EXISTS "FK_communities_brand",
        DROP COLUMN IF EXISTS "brand_id",
        DROP COLUMN IF EXISTS "settings",
        DROP COLUMN IF EXISTS "visibility",
        DROP COLUMN IF EXISTS "slug"
    `);
    await queryRunner.query(`
      ALTER TABLE "communities" ADD CONSTRAINT "UQ_communities_creator" UNIQUE ("creator_id")
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "brands"`);
  }
}
