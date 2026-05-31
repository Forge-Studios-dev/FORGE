import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserDeletedAt1745000000000 implements MigrationInterface {
  name = 'UserDeletedAt1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_deleted_at" ON "users" ("deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_deleted_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "deleted_at"`);
  }
}
