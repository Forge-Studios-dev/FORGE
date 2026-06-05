import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeSubscriptionSource1780000000000 implements MigrationInterface {
  name = 'AddStripeSubscriptionSource1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "member_subscriptions_source_enum" ADD VALUE IF NOT EXISTS 'stripe'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    /* PostgreSQL does not support removing enum values safely */
  }
}
