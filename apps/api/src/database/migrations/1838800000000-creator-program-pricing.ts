import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatorProgramPricing1838800000000 implements MigrationInterface {
  name = 'CreatorProgramPricing1838800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE creator_programs
        ADD COLUMN IF NOT EXISTS price_cents INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100) NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE creator_programs
        DROP COLUMN IF EXISTS stripe_price_id,
        DROP COLUMN IF EXISTS price_cents
    `);
  }
}
