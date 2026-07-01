import { MigrationInterface, QueryRunner } from 'typeorm';

export class CohortCommunityId1838600000000 implements MigrationInterface {
  name = 'CohortCommunityId1838600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE course_cohorts
        ADD COLUMN IF NOT EXISTS community_id UUID NULL
          REFERENCES communities(id) ON DELETE SET NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_course_cohorts_community_id ON course_cohorts(community_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_course_cohorts_community_id`);
    await queryRunner.query(
      `ALTER TABLE course_cohorts DROP COLUMN IF EXISTS community_id`,
    );
  }
}
