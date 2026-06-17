import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityPosts1810000000000 implements MigrationInterface {
  name = 'CommunityPosts1810000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_posts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "community_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "title" character varying(300),
        "body" text NOT NULL,
        "post_type" character varying(32) NOT NULL DEFAULT 'post',
        "is_pinned" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_posts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_posts_community" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_posts_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_community_posts_community" ON "community_posts" ("community_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "community_posts"`);
  }
}
