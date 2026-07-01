import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConversationGroupDm1839200000000 implements MigrationInterface {
  name = 'ConversationGroupDm1839200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT FALSE`,
    );
    await queryRunner.query(
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS name VARCHAR(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE conversations ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE conversations DROP COLUMN IF EXISTS creator_id`);
    await queryRunner.query(`ALTER TABLE conversations DROP COLUMN IF EXISTS name`);
    await queryRunner.query(`ALTER TABLE conversations DROP COLUMN IF EXISTS is_group`);
  }
}
