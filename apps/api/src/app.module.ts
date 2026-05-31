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
import { PlatformModule } from './modules/platform/platform.module';
import { forgeClsSetup } from './common/cls/forge-cls.setup';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ClsUserInterceptor } from './common/interceptors/cls-user.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { ConsumerOnlyGuard } from './common/guards/consumer-only.guard';
import { EmailVerifiedGuard } from './common/guards/email-verified.guard';
import { HealthController } from './health.controller';
import { MetricsController } from './common/metrics/metrics.controller';
import { bullMqConnectionFromConfig } from './config/bull-redis.util';
import { redisTlsOptions } from './common/redis/redis-tls.util';
import { VIDEO_PROCESSING_QUEUE } from './modules/content/videos.service';
import { ANALYTICS_INGEST_QUEUE } from './modules/analytics/analytics-ingest.constants';
import { PUSH_DISPATCH_QUEUE } from './modules/notifications/push-dispatch.constants';
import { FirebaseModule } from './modules/firebase/firebase.module';

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
              traceId: (req as { traceId?: string }).traceId,
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
        const nodeEnv = config.get<string>('nodeEnv') || 'development';
        const tls = redisTlsOptions(url, nodeEnv);
        return {
          type: 'single',
          url,
          ...(tls ? { options: tls } : {}),
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

    BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE }),
    BullModule.registerQueue({
      name: ANALYTICS_INGEST_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 86400, count: 10000 },
      },
    }),
    BullModule.registerQueue({ name: PUSH_DISPATCH_QUEUE }),

    EventEmitterModule.forRoot(),

    FirebaseModule,
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
    PlatformModule,
  ],

  controllers: [HealthController, MetricsController],
  providers: [
    EmailVerifiedGuard,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ClsUserInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ConsumerOnlyGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: EmailVerifiedGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
