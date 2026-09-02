import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProgramPurchases2290000000000 implements MigrationInterface {
  name = 'ProgramPurchases2290000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "program_purchases" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "program_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "stripe_checkout_session_id" varchar NULL,
        "stripe_payment_intent_id" varchar NULL,
        "amount_cents" int NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'usd',
        "status" varchar(32) NOT NULL DEFAULT 'completed',
        "purchased_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_program_purchases" PRIMARY KEY ("id"),
        CONSTRAINT "FK_program_purchases_program" FOREIGN KEY ("program_id") REFERENCES "courses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_program_purchases_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_program_purchases_program_user"
      ON "program_purchases" ("program_id", "user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_program_purchases_stripe_session"
      ON "program_purchases" ("stripe_checkout_session_id")
      WHERE "stripe_checkout_session_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_program_purchases_stripe_session"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_program_purchases_program_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "program_purchases"`);
  }
}
