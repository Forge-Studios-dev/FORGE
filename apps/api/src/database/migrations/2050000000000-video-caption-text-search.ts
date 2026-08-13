import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoCaptionTextSearch2050000000000 implements MigrationInterface {
  name = 'VideoCaptionTextSearch2050000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "caption_text" text
    `);

    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "search_vector"`);

    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A')
        || setweight(to_tsvector('english', coalesce("description", '')), 'B')
        || setweight(to_tsvector('english', coalesce("tags_search_text", '')), 'C')
        || setweight(to_tsvector('english', coalesce("caption_text", '')), 'D')
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
        || setweight(to_tsvector('english', coalesce("tags_search_text", '')), 'C')
      ) STORED
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_search_vector_gin"
      ON "videos" USING gin ("search_vector")
    `);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "caption_text"`);
  }
}
