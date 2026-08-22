import { MigrationInterface, QueryRunner } from 'typeorm';

export class StudyGroups2180000000000 implements MigrationInterface {
  name = 'StudyGroups2180000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS study_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        group_type VARCHAR(20) NOT NULL
          CHECK (group_type IN ('study', 'accountability')),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        topic TEXT,
        course_id UUID,
        max_members INT,
        is_private BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_study_groups_type_private ON study_groups(group_type, is_private)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS study_group_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL DEFAULT 'member'
          CHECK (role IN ('owner', 'member')),
        status VARCHAR(10) NOT NULL DEFAULT 'active'
          CHECK (status IN ('pending', 'active')),
        streak_count INT NOT NULL DEFAULT 0,
        last_check_in_at TIMESTAMPTZ,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_study_group_members_group_user ON study_group_members(group_id, user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_study_group_members_group_status ON study_group_members(group_id, status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS study_group_check_ins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(10) NOT NULL DEFAULT 'done'
          CHECK (status IN ('done', 'missed')),
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_study_group_check_ins_group_created ON study_group_check_ins(group_id, created_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS study_group_check_ins`);
    await queryRunner.query(`DROP TABLE IF EXISTS study_group_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS study_groups`);
  }
}
