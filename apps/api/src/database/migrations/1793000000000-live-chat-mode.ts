import { MigrationInterface, QueryRunner } from 'typeorm';

export class LiveChatMode1793000000000 implements MigrationInterface {
  name = 'LiveChatMode1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."streams_chat_mode_enum" AS ENUM ('all', 'followers', 'subscribers', 'mods_only');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "streams"
      ADD COLUMN IF NOT EXISTS "chat_mode" "public"."streams_chat_mode_enum" NOT NULL DEFAULT 'all'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "chat_mode"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."streams_chat_mode_enum"`);
  }
}
