import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStreamMuxAssetId1714974500000 implements MigrationInterface {
  name = 'AddStreamMuxAssetId1714974500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "streams" ADD COLUMN IF NOT EXISTS "mux_asset_id" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN "mux_asset_id"`);
  }
}

