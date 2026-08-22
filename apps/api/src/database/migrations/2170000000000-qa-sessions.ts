import { MigrationInterface, QueryRunner } from 'typeorm';

export class QaSessions2170000000000 implements MigrationInterface {
  name = 'QaSessions2170000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS qa_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        community_id UUID,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        status VARCHAR(15) NOT NULL DEFAULT 'scheduled'
          CHECK (status IN ('scheduled', 'live', 'ended')),
        scheduled_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_qa_sessions_creator_id ON qa_sessions(creator_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_qa_sessions_creator_status ON qa_sessions(creator_id, status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS qa_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES qa_sessions(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        status VARCHAR(15) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'answered', 'dismissed')),
        upvote_count INT NOT NULL DEFAULT 0,
        answered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_qa_questions_session_status ON qa_questions(session_id, status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS qa_question_upvotes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_id UUID NOT NULL REFERENCES qa_questions(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_question_upvotes_question_user ON qa_question_upvotes(question_id, user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS qa_question_upvotes`);
    await queryRunner.query(`DROP TABLE IF EXISTS qa_questions`);
    await queryRunner.query(`DROP TABLE IF EXISTS qa_sessions`);
  }
}
