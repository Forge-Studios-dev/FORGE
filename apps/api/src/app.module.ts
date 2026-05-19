import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule, ClsMiddleware } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import type { Params } from 'nestjs-pino';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ContentModule } from './modules/content/content.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { FeedModule } from './modules/feed/feed.module';
import { StreamingModule } from './modules/streaming/streaming.module';
import { WorkersModule } from './modules/workers/workers.module';
import { AdminModule } from './modules/admin/admin.module';
import { PlaylistsModule } from './modules/playlists/playlists.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { GatewayModule } from './gateway/gateway.module';
import { MailModule } from './modules/mail/mail.module';
import { SearchModule } from './modules/search/search.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { forgeClsSetup } from './common/cls/forge-cls.setup';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ClsUserInterceptor } from './common/interceptors/cls-user.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { HealthController } from './health.controller';
import { MetricsController } from './common/metrics/metrics.controller';
import { bullMqConnectionFromConfig } from './config/bull-redis.util';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: false,
        setup: forgeClsSetup,
      },
    }),

    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): Params => {
        if (config.get<boolean>('workerOnly')) {
          return {
            exclude: [{ path: '*', method: RequestMethod.ALL }],
            pinoHttp: { autoLogging: false },
          };
        }
        const isProd = config.get<string>('nodeEnv') === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            transport: isProd
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: { singleLine: true, colorize: true },
                },
            customProps: (req) => ({
              correlationId: (req as { correlationId?: string }).correlationId,
            }),
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('rateLimit.ttl') || 60,
            limit: config.get<number>('rateLimit.limit') || 100,
          },
        ],
      }),
    }),

    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('redis.url') || 'redis://localhost:6379';
        const useTls = url.startsWith('rediss://');
        return {
          type: 'single',
          url,
          ...(useTls ? { options: { tls: { rejectUnauthorized: false } } } : {}),
        };
      },
    }),

    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: bullMqConnectionFromConfig({
          url: config.get<string>('redis.url'),
          host: config.get<string>('redis.host') || 'localhost',
          port: config.get<number>('redis.port') || 6379,
          password: config.get<string>('redis.password') || undefined,
        }),
      }),
    }),

    EventEmitterModule.forRoot(),

    DatabaseModule,
    MailModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ContentModule,
    EngagementModule,
    FeedModule,
    StreamingModule,
    WorkersModule,
    AdminModule,
    PlaylistsModule,
    NotificationsModule,
    GatewayModule,
    SearchModule,
    ReportsModule,
    AnalyticsModule,
  ],

  controllers: [HealthController, MetricsController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ClsUserInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
