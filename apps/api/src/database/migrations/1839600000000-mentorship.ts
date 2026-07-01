import { MigrationInterface, QueryRunner } from 'typeorm';

export class Mentorship1839600000000 implements MigrationInterface {
  name = 'Mentorship1839600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mentorship_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL,
        skills TEXT[] NOT NULL DEFAULT '{}',
        goals TEXT,
        max_mentees INTEGER NOT NULL DEFAULT 3,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        bio TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(community_id, user_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_mentorship_profiles_community ON mentorship_profiles(community_id, role, status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mentorship_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mentee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        match_score INTEGER NOT NULL DEFAULT 0,
        session_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(mentor_id, mentee_id, community_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_mentorship_matches_community ON mentorship_matches(community_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_mentorship_matches_mentee ON mentorship_matches(mentee_id, community_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS mentorship_matches`);
    await queryRunner.query(`DROP TABLE IF EXISTS mentorship_profiles`);
  }
}
