import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailDigestLastSent2030000000000 implements MigrationInterface {
  name = 'EmailDigestLastSent2030000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "last_email_digest_sent_at" timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "last_email_digest_sent_at"
    `);
  }
}
