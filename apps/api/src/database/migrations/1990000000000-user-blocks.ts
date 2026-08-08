import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserBlocks1990000000000 implements MigrationInterface {
  name = 'UserBlocks1990000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_blocks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "blocker_id" uuid NOT NULL,
        "blocked_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_blocks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_blocks_blocker_blocked" UNIQUE ("blocker_id", "blocked_id"),
        CONSTRAINT "FK_user_blocks_blocker" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_user_blocks_blocked" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_blocks_blocker_id" ON "user_blocks" ("blocker_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_user_blocks_blocked_id" ON "user_blocks" ("blocked_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_blocks_blocked_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_blocks_blocker_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_blocks"`);
  }
}
