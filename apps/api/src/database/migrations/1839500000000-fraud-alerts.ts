import { MigrationInterface, QueryRunner } from 'typeorm';

export class FraudAlerts1839500000000 implements MigrationInterface {
  name = 'FraudAlerts1839500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fraud_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        signal VARCHAR(60) NOT NULL,
        risk_score INTEGER NOT NULL DEFAULT 50,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        metadata JSONB NOT NULL DEFAULT '{}',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON fraud_alerts(user_id, signal)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status, created_at DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS fraud_alerts`);
  }
}
