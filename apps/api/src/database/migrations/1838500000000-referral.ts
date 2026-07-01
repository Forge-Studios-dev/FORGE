import { MigrationInterface, QueryRunner } from 'typeorm';

export class Referral1838500000000 implements MigrationInterface {
  name = 'Referral1838500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_referral_codes (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL,
        code        VARCHAR(12) NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_referral_user   UNIQUE (user_id),
        CONSTRAINT uq_referral_code   UNIQUE (code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_referrals (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        referrer_id       UUID NOT NULL,
        referred_user_id  UUID NOT NULL,
        referral_code     VARCHAR(12) NOT NULL,
        status            VARCHAR(10) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'completed')),
        reward_granted    BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_referral_referred UNIQUE (referred_user_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_referrals_referrer ON user_referrals (referrer_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_referrals`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_referral_codes`);
  }
}
