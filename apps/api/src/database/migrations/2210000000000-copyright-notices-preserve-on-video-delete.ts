import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * copyright_notices.video_id was ON DELETE CASCADE -- hard-deleting a video
 * destroyed any DMCA notice/counter-notice history tied to it, undermining
 * the legally-defensible audit trail this table exists for (see
 * copyright-notice.entity.ts's doc comment on 17 U.S.C. §512). Switches to
 * ON DELETE SET NULL: the notice row (claimant info, statements, signature)
 * survives; only the link to the now-deleted video is cleared.
 */
export class CopyrightNoticesPreserveOnVideoDelete2210000000000 implements MigrationInterface {
  name = 'CopyrightNoticesPreserveOnVideoDelete2210000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "copyright_notices" ALTER COLUMN "video_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "copyright_notices" DROP CONSTRAINT IF EXISTS "copyright_notices_video_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "copyright_notices"
      ADD CONSTRAINT "copyright_notices_video_id_fkey"
      FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "copyright_notices" DROP CONSTRAINT IF EXISTS "copyright_notices_video_id_fkey"
    `);
    await queryRunner.query(`
      ALTER TABLE "copyright_notices"
      ADD CONSTRAINT "copyright_notices_video_id_fkey"
      FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE
    `);
    // Not reversible if any row already has video_id = NULL from the SET NULL
    // behavior above -- re-adding NOT NULL would fail on those rows. Left as
    // DROP NOT NULL only in the up(); intentionally not re-added here.
  }
}
