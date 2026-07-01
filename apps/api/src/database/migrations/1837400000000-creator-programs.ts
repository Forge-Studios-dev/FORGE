import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatorPrograms1837400000000 implements MigrationInterface {
  name = 'CreatorPrograms1837400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS creator_programs (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        creator_id uuid NOT NULL,
        name varchar(120) NOT NULL,
        slug varchar(120) NOT NULL,
        description text,
        community_id uuid NULL,
        is_published boolean NOT NULL DEFAULT false,
        sort_order integer NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT PK_creator_programs PRIMARY KEY (id),
        CONSTRAINT FK_creator_programs_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_creator_programs_community FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL,
        CONSTRAINT UQ_creator_programs_slug UNIQUE (creator_id, slug)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_creator_programs_creator
      ON creator_programs (creator_id, is_published, sort_order)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS creator_program_courses (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        program_id uuid NOT NULL,
        course_id uuid NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        CONSTRAINT PK_creator_program_courses PRIMARY KEY (id),
        CONSTRAINT FK_creator_program_courses_program FOREIGN KEY (program_id) REFERENCES creator_programs(id) ON DELETE CASCADE,
        CONSTRAINT FK_creator_program_courses_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        CONSTRAINT UQ_creator_program_courses UNIQUE (program_id, course_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_creator_program_courses_program
      ON creator_program_courses (program_id, sort_order)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS creator_program_courses`);
    await queryRunner.query(`DROP TABLE IF EXISTS creator_programs`);
  }
}
