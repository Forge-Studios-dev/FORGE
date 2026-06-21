import { MigrationInterface, QueryRunner } from 'typeorm';

/** One access-granting subscription per user+creator+community scope. */
export class MemberSubscriptionActiveUnique1837000000000 implements MigrationInterface {
  name = 'MemberSubscriptionActiveUnique1837000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_member_subscriptions_active_scope
      ON member_subscriptions (
        user_id,
        creator_id,
        COALESCE(community_id, '00000000-0000-0000-0000-000000000000'::uuid)
      )
      WHERE status IN ('active', 'trial', 'grace_period', 'renewal_pending')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_member_subscriptions_active_scope`);
  }
}
