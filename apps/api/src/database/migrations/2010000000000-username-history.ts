import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsernameHistory2010000000000 implements MigrationInterface {
  name = 'UsernameHistory2010000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "username_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "username" varchar(50) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_username_history" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_username_history_username" UNIQUE ("username"),
        CONSTRAINT "FK_username_history_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_username_history_user_id" ON "username_history" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_username_history_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "username_history"`);
  }
}
