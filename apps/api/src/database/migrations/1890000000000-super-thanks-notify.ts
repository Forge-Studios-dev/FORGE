import { MigrationInterface, QueryRunner } from 'typeorm';

export class SuperThanksNotify1890000000000 implements MigrationInterface {
  name = 'SuperThanksNotify1890000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" ADD VALUE IF NOT EXISTS 'super_thanks'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres cannot remove enum values safely
  }
}
