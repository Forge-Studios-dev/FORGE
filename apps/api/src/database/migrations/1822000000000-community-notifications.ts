import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityNotifications1822000000000 implements MigrationInterface {
  name = 'CommunityNotifications1822000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of ['community_role_assigned', 'community_banned', 'community_post_new']) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  }

  public async down(): Promise<void> {
    /* Postgres enum values cannot be removed safely */
  }
}
