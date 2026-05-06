import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatorApprovalToUsers1714970000000 implements MigrationInterface {
  name = 'AddCreatorApprovalToUsers1714970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typname = 'users_creator_status_enum'
        ) THEN
          CREATE TYPE "public"."users_creator_status_enum" AS ENUM ('pending', 'approved', 'rejected');
        END IF;
      END$$;
    `);

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "creator_status" "public"."users_creator_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "creator_requested_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "creator_reviewed_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "creator_review_note" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "creator_review_note"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "creator_reviewed_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "creator_requested_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "creator_status"`);
    await queryRunner.query(`DROP TYPE "public"."users_creator_status_enum"`);
  }
}

