import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds end_reason to streams so auto-terminated sessions (host disconnect
 * grace period expired) are distinguishable from creator-initiated ends —
 * needed for the live auto-termination/recovery flow (see
 * mux-live-sync.service.ts finalizeStreamEnded / streaming.service.ts endStream).
 */
export class StreamEndReason1839900000000 implements MigrationInterface {
  name = 'StreamEndReason1839900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "streams"
      ADD COLUMN IF NOT EXISTS "end_reason" varchar(32)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "end_reason"`);
  }
}
