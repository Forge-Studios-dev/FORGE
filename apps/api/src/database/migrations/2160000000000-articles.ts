import { MigrationInterface, QueryRunner } from 'typeorm';

export class Articles2160000000000 implements MigrationInterface {
  name = 'Articles2160000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS articles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(220) NOT NULL,
        excerpt TEXT,
        body_markdown TEXT NOT NULL,
        cover_image_url TEXT,
        category_id UUID,
        visibility VARCHAR(15) NOT NULL DEFAULT 'public'
          CHECK (visibility IN ('public', 'subscribers', 'tier')),
        required_tier_id UUID,
        publish_status VARCHAR(15) NOT NULL DEFAULT 'draft'
          CHECK (publish_status IN ('draft', 'published')),
        view_count INT NOT NULL DEFAULT 0,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_articles_creator_id ON articles(creator_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_articles_creator_publish_status ON articles(creator_id, publish_status)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_creator_slug ON articles(creator_id, slug)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS articles`);
  }
}
