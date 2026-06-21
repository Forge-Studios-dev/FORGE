import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityMembersAndSessionToken1835000000000 implements MigrationInterface {
  name = 'CommunityMembersAndSessionToken1835000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status varchar(32) NOT NULL DEFAULT 'active',
        source varchar(32) NOT NULL DEFAULT 'join_request',
        joined_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (community_id, user_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_members_community_status
      ON community_members (community_id, status)
    `);
    await queryRunner.query(`
      ALTER TABLE access_session_audit
      ADD COLUMN IF NOT EXISTS session_token varchar(128) NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_access_session_audit_token
      ON access_session_audit (session_token)
      WHERE session_token IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_access_session_audit_token`);
    await queryRunner.query(
      `ALTER TABLE access_session_audit DROP COLUMN IF EXISTS session_token`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_community_members_community_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS community_members`);
  }
}
