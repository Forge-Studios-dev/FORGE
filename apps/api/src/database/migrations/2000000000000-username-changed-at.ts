import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsernameChangedAt2000000000000 implements MigrationInterface {
  name = 'UsernameChangedAt2000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "username_changed_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "username_changed_at"
    `);
  }
}
