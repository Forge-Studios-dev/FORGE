import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables pg_stat_statements for query ranking (Neon: also enable in console if needed).
 * Safe to run repeatedly; no-op if extension unavailable (local Postgres without contrib).
 */
export class PgStatStatements1793000000000 implements MigrationInterface {
  name = 'PgStatStatements1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`);
  }

  public async down(): Promise<void> {
    /* Intentionally no-op — dropping pg_stat_statements is disruptive in shared Neon projects. */
  }
}
