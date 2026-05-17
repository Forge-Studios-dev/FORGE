import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envCandidates = [
  // Commands often run from repo root (npm workspaces)
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(process.cwd(), '.env'),
  // Commands sometimes run from apps/api itself
  resolve(process.cwd(), '.env.local'),
];

const firstExistingEnv = envCandidates.find((p) => existsSync(p));
if (firstExistingEnv) {
  dotenv.config({ path: firstExistingEnv });
} else {
  dotenv.config();
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'forge',
  password: process.env.DB_PASSWORD || 'forge',
  database: process.env.DB_NAME || 'forge_db',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  migrationsRun: true,
  logging: process.env.NODE_ENV === 'development',
  maxQueryExecutionTime: parseInt(process.env.DB_SLOW_QUERY_MS || '2000', 10),
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '10000', 10),
  },
});
