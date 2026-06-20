import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityReportTargets1825000000000 implements MigrationInterface {
  name = 'CommunityReportTargets1825000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "community_reports"
      ADD COLUMN IF NOT EXISTS "target_type" character varying(32) NOT NULL DEFAULT 'message'
    `);
    await queryRunner.query(`
      ALTER TABLE "community_reports"
      ADD COLUMN IF NOT EXISTS "post_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "community_reports"
      ADD COLUMN IF NOT EXISTS "poll_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "community_reports"
      ADD COLUMN IF NOT EXISTS "reported_user_id" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "community_reports" DROP COLUMN IF EXISTS "reported_user_id"`);
    await queryRunner.query(`ALTER TABLE "community_reports" DROP COLUMN IF EXISTS "poll_id"`);
    await queryRunner.query(`ALTER TABLE "community_reports" DROP COLUMN IF EXISTS "post_id"`);
    await queryRunner.query(`ALTER TABLE "community_reports" DROP COLUMN IF EXISTS "target_type"`);
  }
}
