import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlaylists1714971000000 implements MigrationInterface {
  name = 'AddPlaylists1714971000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "playlists" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_playlists_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_playlists_user_id" ON "playlists" ("user_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "playlist_videos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "playlist_id" uuid NOT NULL,
        "video_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_playlist_videos_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_playlist_videos_playlist_video" UNIQUE ("playlist_id", "video_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_playlist_videos_playlist_id" ON "playlist_videos" ("playlist_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_playlist_videos_video_id" ON "playlist_videos" ("video_id")`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_playlist_videos_playlist') THEN
          ALTER TABLE "playlist_videos"
          ADD CONSTRAINT "FK_playlist_videos_playlist"
          FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_playlist_videos_video') THEN
          ALTER TABLE "playlist_videos"
          ADD CONSTRAINT "FK_playlist_videos_video"
          FOREIGN KEY ("video_id") REFERENCES "videos"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "playlist_videos" DROP CONSTRAINT "FK_playlist_videos_video"`);
    await queryRunner.query(`ALTER TABLE "playlist_videos" DROP CONSTRAINT "FK_playlist_videos_playlist"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_playlist_videos_video_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_playlist_videos_playlist_id"`);
    await queryRunner.query(`DROP TABLE "playlist_videos"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_playlists_user_id"`);
    await queryRunner.query(`DROP TABLE "playlists"`);
  }
}

