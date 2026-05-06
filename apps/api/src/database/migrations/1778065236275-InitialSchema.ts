import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1714960000000 implements MigrationInterface {
    name = 'InitialSchema1714960000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Baseline: if schema already exists (common for older dev DBs created via synchronize),
        // do nothing and let TypeORM mark this migration as executed.
        const hasUsers = await queryRunner.hasTable("users");
        if (hasUsers) return;

        await queryRunner.query(`
            CREATE TABLE "categories" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(100) NOT NULL,
                "slug" character varying(120) NOT NULL,
                "icon_url" character varying,
                "description" character varying(500),
                "sort_order" integer NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_8b0be371d28245da6e4f4b61878" UNIQUE ("name"),
                CONSTRAINT "UQ_420d9f679d41281f282f5bc7d09" UNIQUE ("slug"),
                CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "subcategories" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "category_id" uuid NOT NULL,
                "name" character varying(100) NOT NULL,
                "slug" character varying(120) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_793ef34ad0a3f86f09d4837007c" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_f7b015bc580ae5179ba5a4f42e" ON "subcategories" ("category_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "skill_tags" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "subcategory_id" uuid NOT NULL,
                "name" character varying(100) NOT NULL,
                "slug" character varying(120) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_b9b1d546062451f171f1d8e0ba9" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_a1e967f14fcba0217fd00be90c" ON "skill_tags" ("subcategory_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "likes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "video_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_2c50d9d69c25c7de2f16e7a6205" UNIQUE ("user_id", "video_id"),
                CONSTRAINT "PK_a9323de3f8bced7539a794b4a37" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3f519ed95f775c781a25408917" ON "likes" ("user_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_25670356bf27956730da634898" ON "likes" ("video_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "comments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "video_id" uuid NOT NULL,
                "content" text NOT NULL,
                "parent_id" uuid,
                "like_count" integer NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_d6f93329801a93536da4241e38" ON "comments" ("parent_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_99832a33b267d00258c1b0b6eb" ON "comments" ("video_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."videos_status_enum" AS ENUM(
                'uploading',
                'pending',
                'processing',
                'ready',
                'failed'
            )
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."videos_visibility_enum" AS ENUM('public', 'private', 'unlisted')
        `);
        await queryRunner.query(`
            CREATE TABLE "videos" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "title" character varying(200) NOT NULL,
                "description" character varying(2000),
                "status" "public"."videos_status_enum" NOT NULL DEFAULT 'pending',
                "upload_content_type" character varying(100),
                "upload_file_size_bytes" bigint,
                "upload_completed_at" TIMESTAMP WITH TIME ZONE,
                "failure_reason" character varying(500),
                "visibility" "public"."videos_visibility_enum" NOT NULL DEFAULT 'public',
                "s3_key" character varying,
                "hls_url" character varying,
                "thumbnail_url" character varying,
                "duration_seconds" double precision,
                "file_size_bytes" bigint,
                "view_count" integer NOT NULL DEFAULT '0',
                "like_count" integer NOT NULL DEFAULT '0',
                "comment_count" integer NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_10db4256c96824e89c22fff501" ON "videos" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_ece1558efc6efd53eb530479db" ON "videos" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_900733992fb36a6d855308c003" ON "videos" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."streams_status_enum" AS ENUM('idle', 'live', 'ended')
        `);
        await queryRunner.query(`
            CREATE TABLE "streams" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "title" character varying(200) NOT NULL,
                "description" character varying(1000),
                "mux_stream_id" character varying,
                "mux_live_stream_id" character varying,
                "mux_asset_id" character varying,
                "stream_key" character varying,
                "rtmp_url" character varying,
                "playback_url" character varying,
                "thumbnail_url" character varying,
                "status" "public"."streams_status_enum" NOT NULL DEFAULT 'idle',
                "viewer_count" integer NOT NULL DEFAULT '0',
                "started_at" TIMESTAMP,
                "ended_at" TIMESTAMP,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_40440b6f569ebc02bc71c25c499" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_0081af4f9687bd03cbd628ed49" ON "streams" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_2622fde091074f8008b1fa03cf" ON "streams" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "follows" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "follower_id" uuid NOT NULL,
                "following_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_8109e59f691f0444b43420f6987" UNIQUE ("follower_id", "following_id"),
                CONSTRAINT "PK_8988f607744e16ff79da3b8a627" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_c518e3988b9c057920afaf2d8c" ON "follows" ("following_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_54b5dc2739f2dea57900933db6" ON "follows" ("follower_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "refresh_tokens" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "token_hash" character varying NOT NULL,
                "expires_at" TIMESTAMP NOT NULL,
                "revoked" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_a7838d2ba25be1342091b6695f" ON "refresh_tokens" ("token_hash")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'creator', 'admin')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."users_creator_status_enum" AS ENUM('pending', 'approved', 'rejected')
        `);
        await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying(255) NOT NULL,
                "username" character varying(50) NOT NULL,
                "display_name" character varying(100) NOT NULL,
                "password_hash" character varying NOT NULL,
                "bio" character varying(500),
                "avatar_url" character varying,
                "banner_url" character varying,
                "role" "public"."users_role_enum" NOT NULL DEFAULT 'user',
                "creator_status" "public"."users_creator_status_enum",
                "creator_requested_at" TIMESTAMP WITH TIME ZONE,
                "creator_reviewed_at" TIMESTAMP WITH TIME ZONE,
                "creator_review_note" character varying(500),
                "is_verified" boolean NOT NULL DEFAULT false,
                "follower_count" integer NOT NULL DEFAULT '0',
                "following_count" integer NOT NULL DEFAULT '0',
                "video_count" integer NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")
        `);
        await queryRunner.query(`
            CREATE TABLE "playlist_videos" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "playlist_id" uuid NOT NULL,
                "video_id" uuid NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_e5d02e99acc97c8e3327e4ae1cf" UNIQUE ("playlist_id", "video_id"),
                CONSTRAINT "PK_b278f3df494d22d32012502e5a9" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_d2e54860e84dc3cbe6e9abd07c" ON "playlist_videos" ("video_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_a40a66db754147f17010ec454b" ON "playlist_videos" ("playlist_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "playlists" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "title" character varying(200) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_a4597f4189a75d20507f3f7ef0d" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_a3ea169575c25e5c55494d7f38" ON "playlists" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."notifications_type_enum" AS ENUM(
                'creator_approved',
                'creator_rejected',
                'video_ready',
                'stream_started'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "notifications" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "type" "public"."notifications_type_enum" NOT NULL,
                "title" character varying(200) NOT NULL,
                "body" character varying(1000),
                "read_at" TIMESTAMP WITH TIME ZONE,
                "metadata" jsonb,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_77ee7b06d6f802000c0846f3a5" ON "notifications" ("created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_9a8a82462cab47c73d25f49261" ON "notifications" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "video_skill_tags" (
                "video_id" uuid NOT NULL,
                "skill_tag_id" uuid NOT NULL,
                CONSTRAINT "PK_1e83f3ac0e449c690ba63353f9d" PRIMARY KEY ("video_id", "skill_tag_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_4951e091d5d8fc721094fd11e2" ON "video_skill_tags" ("video_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_d8e16e696f03dd50402a012f29" ON "video_skill_tags" ("skill_tag_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "subcategories"
            ADD CONSTRAINT "FK_f7b015bc580ae5179ba5a4f42ec" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "skill_tags"
            ADD CONSTRAINT "FK_a1e967f14fcba0217fd00be90c6" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "likes"
            ADD CONSTRAINT "FK_3f519ed95f775c781a254089171" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "likes"
            ADD CONSTRAINT "FK_25670356bf27956730da6348984" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "comments"
            ADD CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "comments"
            ADD CONSTRAINT "FK_0528681f0d2c6e89116dd3eb3f4" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "comments"
            ADD CONSTRAINT "FK_d6f93329801a93536da4241e386" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "videos"
            ADD CONSTRAINT "FK_900733992fb36a6d855308c0039" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "streams"
            ADD CONSTRAINT "FK_2622fde091074f8008b1fa03cf5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "follows"
            ADD CONSTRAINT "FK_54b5dc2739f2dea57900933db66" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "follows"
            ADD CONSTRAINT "FK_c518e3988b9c057920afaf2d8c0" FOREIGN KEY ("following_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "refresh_tokens"
            ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "playlist_videos"
            ADD CONSTRAINT "FK_a40a66db754147f17010ec454b4" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "playlist_videos"
            ADD CONSTRAINT "FK_d2e54860e84dc3cbe6e9abd07c4" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "video_skill_tags"
            ADD CONSTRAINT "FK_4951e091d5d8fc721094fd11e2c" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE "video_skill_tags"
            ADD CONSTRAINT "FK_d8e16e696f03dd50402a012f292" FOREIGN KEY ("skill_tag_id") REFERENCES "skill_tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "video_skill_tags" DROP CONSTRAINT "FK_d8e16e696f03dd50402a012f292"
        `);
        await queryRunner.query(`
            ALTER TABLE "video_skill_tags" DROP CONSTRAINT "FK_4951e091d5d8fc721094fd11e2c"
        `);
        await queryRunner.query(`
            ALTER TABLE "playlist_videos" DROP CONSTRAINT "FK_d2e54860e84dc3cbe6e9abd07c4"
        `);
        await queryRunner.query(`
            ALTER TABLE "playlist_videos" DROP CONSTRAINT "FK_a40a66db754147f17010ec454b4"
        `);
        await queryRunner.query(`
            ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"
        `);
        await queryRunner.query(`
            ALTER TABLE "follows" DROP CONSTRAINT "FK_c518e3988b9c057920afaf2d8c0"
        `);
        await queryRunner.query(`
            ALTER TABLE "follows" DROP CONSTRAINT "FK_54b5dc2739f2dea57900933db66"
        `);
        await queryRunner.query(`
            ALTER TABLE "streams" DROP CONSTRAINT "FK_2622fde091074f8008b1fa03cf5"
        `);
        await queryRunner.query(`
            ALTER TABLE "videos" DROP CONSTRAINT "FK_900733992fb36a6d855308c0039"
        `);
        await queryRunner.query(`
            ALTER TABLE "comments" DROP CONSTRAINT "FK_d6f93329801a93536da4241e386"
        `);
        await queryRunner.query(`
            ALTER TABLE "comments" DROP CONSTRAINT "FK_0528681f0d2c6e89116dd3eb3f4"
        `);
        await queryRunner.query(`
            ALTER TABLE "comments" DROP CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d"
        `);
        await queryRunner.query(`
            ALTER TABLE "likes" DROP CONSTRAINT "FK_25670356bf27956730da6348984"
        `);
        await queryRunner.query(`
            ALTER TABLE "likes" DROP CONSTRAINT "FK_3f519ed95f775c781a254089171"
        `);
        await queryRunner.query(`
            ALTER TABLE "skill_tags" DROP CONSTRAINT "FK_a1e967f14fcba0217fd00be90c6"
        `);
        await queryRunner.query(`
            ALTER TABLE "subcategories" DROP CONSTRAINT "FK_f7b015bc580ae5179ba5a4f42ec"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_d8e16e696f03dd50402a012f29"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_4951e091d5d8fc721094fd11e2"
        `);
        await queryRunner.query(`
            DROP TABLE "video_skill_tags"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_9a8a82462cab47c73d25f49261"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_77ee7b06d6f802000c0846f3a5"
        `);
        await queryRunner.query(`
            DROP TABLE "notifications"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."notifications_type_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_a3ea169575c25e5c55494d7f38"
        `);
        await queryRunner.query(`
            DROP TABLE "playlists"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_a40a66db754147f17010ec454b"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_d2e54860e84dc3cbe6e9abd07c"
        `);
        await queryRunner.query(`
            DROP TABLE "playlist_videos"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"
        `);
        await queryRunner.query(`
            DROP TABLE "users"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."users_creator_status_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."users_role_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_a7838d2ba25be1342091b6695f"
        `);
        await queryRunner.query(`
            DROP TABLE "refresh_tokens"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_54b5dc2739f2dea57900933db6"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_c518e3988b9c057920afaf2d8c"
        `);
        await queryRunner.query(`
            DROP TABLE "follows"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_2622fde091074f8008b1fa03cf"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_0081af4f9687bd03cbd628ed49"
        `);
        await queryRunner.query(`
            DROP TABLE "streams"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."streams_status_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_900733992fb36a6d855308c003"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_ece1558efc6efd53eb530479db"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_10db4256c96824e89c22fff501"
        `);
        await queryRunner.query(`
            DROP TABLE "videos"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."videos_visibility_enum"
        `);
        await queryRunner.query(`
            DROP TYPE "public"."videos_status_enum"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_99832a33b267d00258c1b0b6eb"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_d6f93329801a93536da4241e38"
        `);
        await queryRunner.query(`
            DROP TABLE "comments"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_25670356bf27956730da634898"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_3f519ed95f775c781a25408917"
        `);
        await queryRunner.query(`
            DROP TABLE "likes"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_a1e967f14fcba0217fd00be90c"
        `);
        await queryRunner.query(`
            DROP TABLE "skill_tags"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_f7b015bc580ae5179ba5a4f42e"
        `);
        await queryRunner.query(`
            DROP TABLE "subcategories"
        `);
        await queryRunner.query(`
            DROP TABLE "categories"
        `);
    }

}
