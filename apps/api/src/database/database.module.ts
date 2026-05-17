import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        // Never use synchronize for this project; it can break prod-like DBs.
        synchronize: false,
        migrationsRun: true,
        logging: config.get<string>('nodeEnv') === 'development',
        maxQueryExecutionTime: config.get<number>('database.slowQueryMs') ?? 2000,
        extra: {
          max: config.get<number>('database.poolMax') ?? 20,
          connectionTimeoutMillis: config.get<number>('database.connectTimeoutMs') ?? 10_000,
        },
        ssl:
          config.get<string>('nodeEnv') === 'production'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
  ],
})
export class DatabaseModule {}
