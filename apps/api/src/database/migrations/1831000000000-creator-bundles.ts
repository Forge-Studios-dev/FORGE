import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatorBundles1831000000000 implements MigrationInterface {
  name = 'CreatorBundles1831000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "creator_bundles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "creator_id" uuid NOT NULL,
        "tier_id" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "slug" character varying(120) NOT NULL,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_creator_bundles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_creator_bundles_creator" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_creator_bundles_tier" FOREIGN KEY ("tier_id") REFERENCES "subscription_tiers"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_creator_bundles_slug" UNIQUE ("creator_id", "slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_creator_bundles_creator"
      ON "creator_bundles" ("creator_id", "is_active", "sort_order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "creator_bundle_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "bundle_id" uuid NOT NULL,
        "resource_type" character varying(64) NOT NULL,
        "resource_id" uuid,
        "sort_order" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_creator_bundle_items" PRIMARY KEY ("id"),
        CONSTRAINT "FK_creator_bundle_items_bundle" FOREIGN KEY ("bundle_id") REFERENCES "creator_bundles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_creator_bundle_items_bundle"
      ON "creator_bundle_items" ("bundle_id", "sort_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "creator_bundle_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "creator_bundles"`);
  }
}
