import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformXp1838200000000 implements MigrationInterface {
  name = 'PlatformXp1838200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_xp (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        xp INT NOT NULL DEFAULT 0,
        level INT NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS platform_xp_grants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(30) NOT NULL,
        xp_awarded INT NOT NULL,
        granted_date DATE NOT NULL DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_platform_xp_grants_lookup
       ON platform_xp_grants(user_id, action_type, granted_date)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS platform_xp_grants`);
    await queryRunner.query(`DROP TABLE IF EXISTS platform_xp`);
  }
}
