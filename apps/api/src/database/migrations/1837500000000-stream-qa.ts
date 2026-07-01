import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Live Q&A mode — extends the existing `stream_messages` table rather than
 * introducing a parallel store. Adds the `question` message type plus the
 * Q&A-only `question_status` and `upvotes` columns, and a partial index for
 * efficient "top questions" listing.
 *
 * `transaction = false` because Postgres forbids `ALTER TYPE ... ADD VALUE`
 * inside a transaction block; each statement therefore commits independently
 * (so the new enum value is visible to the subsequent partial index).
 */
export class StreamQa1837500000000 implements MigrationInterface {
  name = 'StreamQa1837500000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."stream_messages_message_type_enum" ADD VALUE IF NOT EXISTS 'question'
    `);
    await queryRunner.query(`
      ALTER TABLE "stream_messages"
      ADD COLUMN IF NOT EXISTS "question_status" varchar(16) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "stream_messages"
      ADD COLUMN IF NOT EXISTS "upvotes" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_stream_messages_questions
      ON stream_messages (stream_id, upvotes DESC)
      WHERE message_type = 'question' AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_stream_messages_questions`);
    await queryRunner.query(`ALTER TABLE "stream_messages" DROP COLUMN IF EXISTS "upvotes"`);
    await queryRunner.query(`ALTER TABLE "stream_messages" DROP COLUMN IF EXISTS "question_status"`);
    // Note: Postgres cannot drop a single enum value; 'question' is left in place
    // on rollback (harmless — no rows will reference it after columns are dropped).
  }
}
