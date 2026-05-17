import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixFkUuidColumnsV21714980500000 implements MigrationInterface {
  name = 'FixFkUuidColumnsV21714980500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // These columns may exist as varchar from early dev/synchronize runs.
    // Convert in-place (no drop/add) so existing rows are preserved.

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='notifications' AND column_name='user_id'
            AND data_type <> 'uuid'
        ) THEN
          ALTER TABLE "notifications" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='playlists' AND column_name='user_id'
            AND data_type <> 'uuid'
        ) THEN
          ALTER TABLE "playlists" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='subcategories' AND column_name='category_id'
            AND data_type <> 'uuid'
        ) THEN
          ALTER TABLE "subcategories" ALTER COLUMN "category_id" TYPE uuid USING "category_id"::uuid;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='skill_tags' AND column_name='subcategory_id'
            AND data_type <> 'uuid'
        ) THEN
          ALTER TABLE "skill_tags" ALTER COLUMN "subcategory_id" TYPE uuid USING "subcategory_id"::uuid;
        END IF;
      END$$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Not safely reversible.
  }
}

