import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlaylistSearchVector2060000000000 implements MigrationInterface {
  name = 'PlaylistSearchVector2060000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "playlists"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A')
        || setweight(to_tsvector('english', coalesce("description", '')), 'B')
      ) STORED
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_playlists_search_vector_gin"
      ON "playlists" USING gin ("search_vector")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_playlists_search_vector_gin"`);
    await queryRunner.query(`ALTER TABLE "playlists" DROP COLUMN IF EXISTS "search_vector"`);
  }
}
