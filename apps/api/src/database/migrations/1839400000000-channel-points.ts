import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelPoints1839400000000 implements MigrationInterface {
  name = 'ChannelPoints1839400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS channel_points_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
        total_earned INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(community_id, user_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_channel_points_balances_community ON channel_points_balances(community_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS channel_point_rewards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        cost_points INTEGER NOT NULL CHECK (cost_points > 0),
        max_per_user INTEGER,
        global_max INTEGER,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        requires_approval BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_channel_point_rewards_community ON channel_point_rewards(community_id, status)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS channel_point_redemptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reward_id UUID NOT NULL REFERENCES channel_point_rewards(id) ON DELETE CASCADE,
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        cost_points INTEGER NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_channel_point_redemptions_reward ON channel_point_redemptions(reward_id, status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_channel_point_redemptions_user ON channel_point_redemptions(user_id, reward_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS channel_point_redemptions`);
    await queryRunner.query(`DROP TABLE IF EXISTS channel_point_rewards`);
    await queryRunner.query(`DROP TABLE IF EXISTS channel_points_balances`);
  }
}
