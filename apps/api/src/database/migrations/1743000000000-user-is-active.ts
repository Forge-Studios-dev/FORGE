import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserIsActive1743000000000 implements MigrationInterface {
  name = 'UserIsActive1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_is_active" ON "users" ("is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_is_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_active"`);
  }
}
