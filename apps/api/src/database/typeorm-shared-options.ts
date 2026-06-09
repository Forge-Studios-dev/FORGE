import { parseDatabaseConfig } from './parse-database-config';

/** Shared TypeORM fields for AppDataSource and Nest DatabaseModule. */
export function buildTypeOrmPostgresOptions(env: NodeJS.ProcessEnv = process.env) {
  const db = parseDatabaseConfig(env);
  const logging = (env.NODE_ENV || 'development') === 'development';

  return {
    type: 'postgres' as const,
    ...(db.url
      ? { url: db.url }
      : {
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
        }),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    migrationsRun: (env.MIGRATIONS_RUN ?? (env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true',
    migrationsTransactionMode: 'each' as const,
    logging,
    maxQueryExecutionTime: db.slowQueryMs,
    ssl: db.ssl,
    extra: {
      max: db.poolMax,
      connectionTimeoutMillis: db.connectTimeoutMs,
      idleTimeoutMillis: db.idleTimeoutMs,
      allowExitOnIdle: true,
    },
  };
}
