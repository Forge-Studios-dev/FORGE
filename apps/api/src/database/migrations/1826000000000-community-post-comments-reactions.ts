import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityPostCommentsReactions1826000000000 implements MigrationInterface {
  name = 'CommunityPostCommentsReactions1826000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_post_comments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "post_id" uuid NOT NULL,
        "author_id" uuid NOT NULL,
        "body" text NOT NULL,
        "parent_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_post_comments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_post_comments_post" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_post_comments_author" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_post_comments_parent" FOREIGN KEY ("parent_id") REFERENCES "community_post_comments"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_community_post_comments_post" ON "community_post_comments" ("post_id", "created_at" ASC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "community_post_reactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "post_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "reaction_type" character varying(16) NOT NULL DEFAULT 'like',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_community_post_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_community_post_reactions_post" FOREIGN KEY ("post_id") REFERENCES "community_posts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_community_post_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_community_post_reactions_user_post" UNIQUE ("post_id", "user_id", "reaction_type")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_community_post_reactions_post" ON "community_post_reactions" ("post_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "community_post_reactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "community_post_comments"`);
  }
}
