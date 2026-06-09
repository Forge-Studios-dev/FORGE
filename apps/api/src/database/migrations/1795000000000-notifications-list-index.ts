import { MigrationInterface, QueryRunner } from 'typeorm';

/** Composite index for notification list queries (user_id + created_at DESC). */
export class NotificationsListIndex1795000000000 implements MigrationInterface {
  name = 'NotificationsListIndex1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_user_created"
      ON "notifications" ("user_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_member_subscriptions_active_expires"
      ON "member_subscriptions" ("expires_at")
      WHERE "status" = 'active' AND "expires_at" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_member_subscriptions_active_expires"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_user_created"`);
  }
}
