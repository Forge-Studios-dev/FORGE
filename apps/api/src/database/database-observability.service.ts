import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { clampLimit } from '../common/utils/pagination.util';

export type QueryStatRow = {
  queryid: string;
  calls: number;
  totalExecTimeMs: number;
  meanExecTimeMs: number;
  rows: number;
  sharedBlksRead: number;
  sharedBlksHit: number;
  queryPreview: string;
};

@Injectable()
export class DatabaseObservabilityService {
  private readonly logger = new Logger(DatabaseObservabilityService.name);
  private extensionChecked = false;
  private extensionAvailable = false;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getTopQueries(limit = 50): Promise<{
    available: boolean;
    stats: QueryStatRow[];
    message?: string;
  }> {
    const capped = clampLimit(limit, 50, 100);
    const available = await this.isPgStatStatementsAvailable();
    if (!available) {
      return {
        available: false,
        stats: [],
        message:
          'pg_stat_statements is not enabled. Run migrations and enable the extension in Neon console if needed.',
      };
    }

    try {
      const rows = await this.dataSource.query(
        `
        SELECT
          queryid::text AS "queryid",
          calls::bigint AS calls,
          total_exec_time AS "totalExecTimeMs",
          mean_exec_time AS "meanExecTimeMs",
          rows::bigint AS rows,
          shared_blks_read AS "sharedBlksRead",
          shared_blks_hit AS "sharedBlksHit",
          LEFT(query, 300) AS "queryPreview"
        FROM pg_stat_statements
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
          AND query NOT LIKE '%pg_stat_statements%'
        ORDER BY total_exec_time DESC
        LIMIT $1
        `,
        [capped],
      );

      const stats: QueryStatRow[] = (rows as Record<string, unknown>[]).map((row) => ({
        queryid: String(row.queryid),
        calls: Number(row.calls) || 0,
        totalExecTimeMs: Math.round((Number(row.totalExecTimeMs) || 0) * 100) / 100,
        meanExecTimeMs: Math.round((Number(row.meanExecTimeMs) || 0) * 100) / 100,
        rows: Number(row.rows) || 0,
        sharedBlksRead: Number(row.sharedBlksRead) || 0,
        sharedBlksHit: Number(row.sharedBlksHit) || 0,
        queryPreview: String(row.queryPreview ?? ''),
      }));

      return { available: true, stats };
    } catch (err) {
      this.logger.warn(`pg_stat_statements query failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Unable to read pg_stat_statements');
    }
  }

  async resetQueryStats(): Promise<{ ok: true }> {
    const available = await this.isPgStatStatementsAvailable();
    if (!available) {
      throw new ServiceUnavailableException('pg_stat_statements is not enabled');
    }
    await this.dataSource.query(`SELECT pg_stat_statements_reset()`);
    return { ok: true };
  }

  private async isPgStatStatementsAvailable(): Promise<boolean> {
    if (this.extensionChecked) return this.extensionAvailable;
    this.extensionChecked = true;
    try {
      const rows = await this.dataSource.query(
        `SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements' LIMIT 1`,
      );
      this.extensionAvailable = Array.isArray(rows) && rows.length > 0;
    } catch {
      this.extensionAvailable = false;
    }
    return this.extensionAvailable;
  }
}
