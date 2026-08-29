import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminTier2251000000000 implements MigrationInterface {
  name = 'AdminTier2251000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_admin_tier_enum" AS ENUM ('full', 'moderator')
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "admin_tier" "users_admin_tier_enum" NOT NULL DEFAULT 'full'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "users"."admin_tier" IS
        'Platform admin capability tier when role=admin. full=all ops; moderator=read+moderate only.'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "admin_tier"`);
    await queryRunner.query(`DROP TYPE "users_admin_tier_enum"`);
  }
}
