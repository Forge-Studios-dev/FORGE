import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoPublishMetadata1740000000000 implements MigrationInterface {
  name = 'VideoPublishMetadata1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."videos_publish_status_enum" AS ENUM('draft', 'published');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "publish_status" "public"."videos_publish_status_enum" NOT NULL DEFAULT 'draft'
    `);

    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "category_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "indexed_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "videos"
        ADD CONSTRAINT "FK_videos_category"
        FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_category_id"
      ON "videos" ("category_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_publish_status_ready"
      ON "videos" ("published_at" DESC, "id")
      WHERE "status" = 'ready' AND "publish_status" = 'published' AND "visibility" = 'public'
    `);

    await queryRunner.query(`
      UPDATE "videos" v
      SET "category_id" = sub."category_id"
      FROM (
        SELECT DISTINCT ON (vst."video_id") vst."video_id", sc."category_id"
        FROM "video_skill_tags" vst
        INNER JOIN "skill_tags" st ON st."id" = vst."skill_tag_id"
        INNER JOIN "subcategories" sc ON sc."id" = st."subcategory_id"
        ORDER BY vst."video_id", sc."category_id"
      ) sub
      WHERE v."id" = sub."video_id" AND v."category_id" IS NULL
    `);

    await queryRunner.query(`
      UPDATE "videos"
      SET "publish_status" = 'published'
      WHERE "status" = 'ready' AND "publish_status" = 'draft'
    `);

    await queryRunner.query(`
      UPDATE "videos"
      SET "indexed_at" = COALESCE("published_at", "created_at")
      WHERE "status" = 'ready'
        AND "visibility" = 'public'
        AND "moderation_status" = 'none'
        AND "indexed_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_videos_publish_status_ready"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_videos_category_id"`);
    await queryRunner.query(`
      ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "FK_videos_category"
    `);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "indexed_at"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "category_id"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "publish_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."videos_publish_status_enum"`);
  }
}
