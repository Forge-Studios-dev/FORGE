import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserMfaColumns2040000000000 implements MigrationInterface {
  name = 'UserMfaColumns2040000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mfa_enabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "mfa_secret_encrypted" varchar NULL,
      ADD COLUMN IF NOT EXISTS "mfa_backup_code_hashes" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "mfa_enabled",
      DROP COLUMN IF EXISTS "mfa_secret_encrypted",
      DROP COLUMN IF EXISTS "mfa_backup_code_hashes"
    `);
  }
}
