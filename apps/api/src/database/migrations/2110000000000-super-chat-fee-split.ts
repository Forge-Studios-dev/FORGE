import { MigrationInterface, QueryRunner } from 'typeorm';

export class SuperChatFeeSplit2110000000000 implements MigrationInterface {
  name = 'SuperChatFeeSplit2110000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stream_messages"
      ADD COLUMN IF NOT EXISTS "platform_fee_percent" numeric(5,2) NULL,
      ADD COLUMN IF NOT EXISTS "platform_fee_cents" int NULL,
      ADD COLUMN IF NOT EXISTS "creator_net_cents" int NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stream_messages"
      DROP COLUMN IF EXISTS "creator_net_cents",
      DROP COLUMN IF EXISTS "platform_fee_cents",
      DROP COLUMN IF EXISTS "platform_fee_percent"
    `);
  }
}
