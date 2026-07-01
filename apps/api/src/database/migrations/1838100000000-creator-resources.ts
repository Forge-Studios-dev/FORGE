import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatorResources1838100000000 implements MigrationInterface {
  name = 'CreatorResources1838100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS creator_resources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        file_key VARCHAR(500) NOT NULL,
        file_url VARCHAR(1000) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_size_bytes BIGINT,
        visibility VARCHAR(15) NOT NULL DEFAULT 'subscribers'
          CHECK (visibility IN ('public', 'subscribers', 'tier')),
        required_tier_id UUID,
        download_count INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_creator_resources_creator_id ON creator_resources(creator_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_creator_resources_active ON creator_resources(creator_id, is_active)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS creator_resources`);
  }
}
