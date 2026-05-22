import { MigrationInterface, QueryRunner } from 'typeorm';

/** Repair videos that reached ready+published but missed indexed_at (indexing bug). */
export class BackfillVideoIndexedAt1740000000002 implements MigrationInterface {
  name = 'BackfillVideoIndexedAt1740000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "videos"
      SET "indexed_at" = COALESCE("published_at", "created_at")
      WHERE "status" = 'ready'
        AND "publish_status" = 'published'
        AND "visibility" = 'public'
        AND "moderation_status" = 'none'
        AND "indexed_at" IS NULL
        AND ("scheduled_publish_at" IS NULL OR "scheduled_publish_at" <= CURRENT_TIMESTAMP)
        AND ("published_at" IS NULL OR "published_at" <= CURRENT_TIMESTAMP)
    `);
  }

  public async down(): Promise<void> {
    /* data repair — no down */
  }
}
