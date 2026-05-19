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

import { buildTypeOrmPostgresOptions } from './typeorm-shared-options';

export const AppDataSource = new DataSource(buildTypeOrmPostgresOptions(process.env));
