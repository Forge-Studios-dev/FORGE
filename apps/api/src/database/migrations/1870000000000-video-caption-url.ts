import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoCaptionUrl1870000000000 implements MigrationInterface {
  name = 'VideoCaptionUrl1870000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "caption_url" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      DROP COLUMN IF EXISTS "caption_url"
    `);
  }
}
