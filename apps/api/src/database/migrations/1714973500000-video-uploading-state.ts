import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoUploadingState1714973500000 implements MigrationInterface {
  name = 'VideoUploadingState1714973500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new enum value for video status
    await queryRunner.query(`ALTER TYPE "public"."videos_status_enum" ADD VALUE IF NOT EXISTS 'uploading'`);

    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "upload_content_type" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "upload_file_size_bytes" bigint`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "upload_completed_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "failure_reason" character varying(500)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "failure_reason"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "upload_completed_at"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "upload_file_size_bytes"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "upload_content_type"`);
    // Postgres enums cannot safely drop values in a simple down migration.
  }
}

