import { MigrationInterface, QueryRunner } from 'typeorm';

export class StripeConnect1824000000000 implements MigrationInterface {
  name = 'StripeConnect1824000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "stripe_connect_account_id" character varying(255)
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_users_stripe_connect_account" ON "users" ("stripe_connect_account_id") WHERE "stripe_connect_account_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_stripe_connect_account"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_connect_account_id"`);
  }
}
