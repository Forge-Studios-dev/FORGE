import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Folds creator_programs / creator_program_courses into courses.
 *
 * A CreatorProgram is not a distinct content system — it has no lessons/quizzes
 * of its own, it's a named, priced, ordered wrapper around existing Course rows
 * (see creator-program.entity.ts). Keeping it as a second table meant two
 * separate IA branches (Studio "Courses" and "Programs") for what is, at the
 * data level, one row shape: a course that either has its own lessons, or is a
 * bundle pointing at other courses. This migration makes that literal:
 *
 *   - courses gains price_cents / stripe_price_id (Program's standalone
 *     one-time-purchase fields — Course itself had no pricing) and is_bundle.
 *   - course_bundle_items replaces creator_program_courses as a self-referential
 *     join (a course can list other courses as bundle contents).
 *   - Every creator_programs row becomes a courses row with is_bundle = true,
 *     same primary key (so nothing holding a program id needs to change).
 *
 * There is no separate program-enrollment table to migrate — enrolling in a
 * program has only ever meant enrolling in each underlying course
 * (course_enrollments), which is untouched here.
 *
 * Reversible: down() reconstructs the original two tables from courses/
 * course_bundle_items. That is a faithful rollback immediately after this
 * migration runs, but note — if new bundle courses are created (via the
 * post-migration API) before a rollback, down() cannot distinguish "restored
 * legacy program" from "new bundle" and will move all is_bundle rows back into
 * creator_programs. Roll back promptly if at all, not long after real usage.
 */
export class MergeProgramsIntoCourses1839800000000 implements MigrationInterface {
  name = 'MergeProgramsIntoCourses1839800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE courses
        ADD COLUMN IF NOT EXISTS price_cents INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS course_bundle_items (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        bundle_course_id uuid NOT NULL,
        item_course_id uuid NOT NULL,
        sort_order integer NOT NULL DEFAULT 0,
        CONSTRAINT PK_course_bundle_items PRIMARY KEY (id),
        CONSTRAINT FK_course_bundle_items_bundle FOREIGN KEY (bundle_course_id) REFERENCES courses(id) ON DELETE CASCADE,
        CONSTRAINT FK_course_bundle_items_item FOREIGN KEY (item_course_id) REFERENCES courses(id) ON DELETE CASCADE,
        CONSTRAINT UQ_course_bundle_items UNIQUE (bundle_course_id, item_course_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_course_bundle_items_bundle
      ON course_bundle_items (bundle_course_id, sort_order)
    `);

    const programsTableExists = await queryRunner.hasTable('creator_programs');
    if (!programsTableExists) return;

    // Copy programs into courses as is_bundle rows, keeping the same id so any
    // existing reference to a program id still resolves. Disambiguate slug
    // collisions deterministically (same creator using the same slug for a
    // course and a program is possible since they were separate tables).
    await queryRunner.query(`
      INSERT INTO courses (
        id, creator_id, title, slug, description, is_published, community_id,
        price_cents, stripe_price_id, is_bundle, created_at, updated_at
      )
      SELECT
        p.id,
        p.creator_id,
        p.name,
        CASE
          WHEN EXISTS (SELECT 1 FROM courses c WHERE c.creator_id = p.creator_id AND c.slug = p.slug)
          THEN substr(p.slug, 1, 110) || '-bundle-' || substr(p.id::text, 1, 8)
          ELSE p.slug
        END,
        p.description,
        p.is_published,
        p.community_id,
        p.price_cents,
        p.stripe_price_id,
        true,
        p.created_at,
        p.updated_at
      FROM creator_programs p
    `);

    await queryRunner.query(`
      INSERT INTO course_bundle_items (bundle_course_id, item_course_id, sort_order)
      SELECT program_id, course_id, sort_order FROM creator_program_courses
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS creator_program_courses`);
    await queryRunner.query(`DROP TABLE IF EXISTS creator_programs`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
        price_cents INT NOT NULL DEFAULT 0,
        stripe_price_id VARCHAR(100) NULL,
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

    await queryRunner.query(`
      INSERT INTO creator_programs (
        id, creator_id, name, slug, description, community_id, is_published,
        sort_order, price_cents, stripe_price_id, created_at, updated_at
      )
      SELECT id, creator_id, title, slug, description, community_id, is_published,
             0, price_cents, stripe_price_id, created_at, updated_at
      FROM courses WHERE is_bundle = true
    `);
    await queryRunner.query(`
      INSERT INTO creator_program_courses (program_id, course_id, sort_order)
      SELECT bundle_course_id, item_course_id, sort_order FROM course_bundle_items
    `);

    await queryRunner.query(`DELETE FROM course_bundle_items`);
    await queryRunner.query(`DELETE FROM courses WHERE is_bundle = true`);
    await queryRunner.query(`DROP TABLE IF EXISTS course_bundle_items`);
    await queryRunner.query(`
      ALTER TABLE courses
        DROP COLUMN IF EXISTS is_bundle,
        DROP COLUMN IF EXISTS stripe_price_id,
        DROP COLUMN IF EXISTS price_cents
    `);
  }
}
