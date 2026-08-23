import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * notifications.user_id has never had a foreign key to users -- deleting a
 * user left their notification rows orphaned forever, with no referential
 * integrity at all on the column. Deletes any already-orphaned rows first
 * (required for the ADD CONSTRAINT to succeed on existing data), then adds
 * the FK so future user deletions cascade-clean their notifications like
 * every other user-owned table already does.
 */
export class NotificationsUserFk2220000000000 implements MigrationInterface {
  name = 'NotificationsUserFk2220000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "notifications" n
      WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = n.user_id)
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_fkey"
    `);
    // Deleted orphaned rows in up() are not restorable; the FK removal itself is reversible.
  }
}
