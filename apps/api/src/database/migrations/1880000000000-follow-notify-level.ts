import { MigrationInterface, QueryRunner } from 'typeorm';

export class FollowNotifyLevel1880000000000 implements MigrationInterface {
  name = 'FollowNotifyLevel1880000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."follows_notify_level_enum" AS ENUM ('all', 'personalized', 'none');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "follows"
      ADD COLUMN IF NOT EXISTS "notify_level" "public"."follows_notify_level_enum" NOT NULL DEFAULT 'all'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN IF EXISTS "notify_level"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."follows_notify_level_enum"`);
  }
}
