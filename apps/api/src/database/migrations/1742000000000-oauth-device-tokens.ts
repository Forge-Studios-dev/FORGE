import { MigrationInterface, QueryRunner } from 'typeorm';

export class OAuthDeviceTokens1742000000000 implements MigrationInterface {
  name = 'OAuthDeviceTokens1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider varchar(32) NOT NULL,
        provider_id varchar(255) NOT NULL,
        email varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider, provider_id)
      );
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform varchar(16) NOT NULL,
        fcm_token varchar(512) NOT NULL,
        last_seen_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (fcm_token)
      );
      CREATE INDEX IF NOT EXISTS idx_device_tokens_user_active
        ON device_tokens(user_id) WHERE revoked_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS device_tokens`);
    await queryRunner.query(`DROP TABLE IF EXISTS oauth_accounts`);
  }
}
