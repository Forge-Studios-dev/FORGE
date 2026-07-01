import { MigrationInterface, QueryRunner } from 'typeorm';

export class StreamCohostVip1839300000000 implements MigrationInterface {
  name = 'StreamCohostVip1839300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE streams ADD COLUMN IF NOT EXISTS co_host_ids JSONB NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE streams ADD COLUMN IF NOT EXISTS vip_tier_id UUID REFERENCES subscription_tiers(id) ON DELETE SET NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE streams DROP COLUMN IF EXISTS vip_tier_id`);
    await queryRunner.query(`ALTER TABLE streams DROP COLUMN IF EXISTS co_host_ids`);
  }
}
