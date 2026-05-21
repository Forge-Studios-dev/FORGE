import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlaylistVisibility1714981100000 implements MigrationInterface {
  name = 'PlaylistVisibility1714981100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."playlists_visibility_enum" AS ENUM('public', 'private');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "playlists"
      ADD COLUMN IF NOT EXISTS "visibility" "public"."playlists_visibility_enum" NOT NULL DEFAULT 'public'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "playlists" DROP COLUMN IF EXISTS "visibility"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."playlists_visibility_enum"`);
  }
}
