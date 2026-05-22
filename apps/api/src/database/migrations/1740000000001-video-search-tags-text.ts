import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoSearchTagsText1740000000001 implements MigrationInterface {
  name = 'VideoSearchTagsText1740000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "tags_search_text" varchar(2000)
    `);

    await queryRunner.query(`
      UPDATE "videos" v
      SET "tags_search_text" = agg.tag_text
      FROM (
        SELECT
          vst."video_id",
          string_agg(DISTINCT st."name", ' ' ORDER BY st."name") AS tag_text
        FROM "video_skill_tags" vst
        INNER JOIN "skill_tags" st ON st."id" = vst."skill_tag_id"
        GROUP BY vst."video_id"
      ) agg
      WHERE v."id" = agg."video_id" AND (v."tags_search_text" IS NULL OR v."tags_search_text" = '')
    `);

    await queryRunner.query(`
      UPDATE "videos" v
      SET "tags_search_text" = COALESCE(c."name", '') || ' ' || COALESCE(v."tags_search_text", '')
      FROM "categories" c
      WHERE v."category_id" = c."id"
        AND (v."tags_search_text" IS NULL OR v."tags_search_text" NOT LIKE '%' || c."name" || '%')
    `);

    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "search_vector"`);

    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A')
        || setweight(to_tsvector('english', coalesce("description", '')), 'B')
        || setweight(to_tsvector('english', coalesce("tags_search_text", '')), 'C')
      ) STORED
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_search_vector_gin"
      ON "videos" USING gin ("search_vector")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_videos_search_vector_gin"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "search_vector"`);
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A')
        || setweight(to_tsvector('english', coalesce("description", '')), 'B')
      ) STORED
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_search_vector_gin"
      ON "videos" USING gin ("search_vector")
    `);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "tags_search_text"`);
  }
}
