import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlaylistUnlisted1960000000000 implements MigrationInterface {
  name = 'PlaylistUnlisted1960000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."playlists_visibility_enum" ADD VALUE IF NOT EXISTS 'unlisted';
      EXCEPTION
        WHEN duplicate_object THEN null;
        WHEN undefined_object THEN null;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Postgres cannot remove enum values safely; leave 'unlisted' in place.
  }
}
