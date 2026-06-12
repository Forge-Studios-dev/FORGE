import { MigrationInterface, QueryRunner } from 'typeorm';

export class SocialPlatformAudit1796000000000 implements MigrationInterface {
  name = 'SocialPlatformAudit1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, comment_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_comment_likes_comment_id ON comment_likes(comment_id)
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'comment_on_video'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'comment_reply'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'new_follower'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'video_liked'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'direct_message'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS conversation_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (conversation_id, user_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_conversation_members_user_id ON conversation_members(user_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        deleted_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_direct_messages_conversation_created
        ON direct_messages(conversation_id, created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS direct_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS conversation_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS conversations`);
    await queryRunner.query(`DROP TABLE IF EXISTS comment_likes`);
    await queryRunner.query(`ALTER TABLE comments DROP COLUMN IF EXISTS deleted_at`);
  }
}
