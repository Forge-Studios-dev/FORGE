import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ClsModule, ClsMiddleware } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';
import type { Params } from 'nestjs-pino';
import configuration from './config/configuration';
import { isInfraProbePath } from './common/http/infra-probe-path.util';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ContentModule } from './modules/content/content.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { FeedModule } from './modules/feed/feed.module';
import { StreamingModule } from './modules/streaming/streaming.module';
import { LiveBroadcastModule } from './modules/live-broadcast/live-broadcast.module';
import { WorkersModule } from './modules/workers/workers.module';
import { AdminModule } from './modules/admin/admin.module';
import { PlaylistsModule } from './modules/playlists/playlists.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { GatewayModule } from './gateway/gateway.module';
import { MailModule } from './modules/mail/mail.module';
import { SearchModule } from './modules/search/search.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AccountStrikesModule } from './modules/account-strikes/account-strikes.module';
import { CopyrightModule } from './modules/copyright/copyright.module';
import { MonetizationModule } from './modules/monetization/monetization.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PlatformModule } from './modules/platform/platform.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { StreamChatModule } from './modules/stream-chat/stream-chat.module';
import { CommunitiesModule } from './modules/communities/communities.module';
import { CoursesModule } from './modules/courses/courses.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { ChannelPointsModule } from './modules/channel-points/channel-points.module';
import { FraudDetectionModule } from './modules/fraud-detection/fraud-detection.module';
import { AccessSessionsModule } from './modules/access-sessions/access-sessions.module';
import { DirectMessagesModule } from './modules/direct-messages/direct-messages.module';
import { BillingModule } from './modules/billing/billing.module';
import { CreatorResourcesModule } from './modules/creator-resources/creator-resources.module';
import { ReferralModule } from './modules/referral/referral.module';
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
import { BullmqMetricsService } from './common/metrics/bullmq-metrics.service';
import { bullMqConnectionFromConfig } from './config/bull-redis.util';
import { redisTlsOptions } from './common/redis/redis-tls.util';
import { QueuesModule } from './queues/queues.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { RedisThrottlerModule } from './common/throttler/redis-throttler.module';

/** BullMQ consumers run on the Fly worker app only in production (not in Jest). */
function shouldLoadWorkersModule(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  return process.env.WORKER_ONLY === 'true' || process.env.NODE_ENV !== 'production';
}

/** Sentry is initialized in instrument.ts when SENTRY_DSN is set. */
function sentryModuleImports() {
  return process.env.SENTRY_DSN ? [SentryModule.forRoot()] : [];
}

function sentryFilterProviders() {
  return process.env.SENTRY_DSN
    ? [{ provide: APP_FILTER, useClass: SentryGlobalFilter }]
    : [];
}

@Module({
  imports: [
    ...sentryModuleImports(),
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
            // Fly Consul probes hit /health/live every 15s × N machines; Prometheus
            // scrapes /metrics. Logging those floods Fly and looks like "continuous APIs".
            autoLogging: {
              ignore: (req) => isInfraProbePath(req.url),
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'password',
                'refreshToken',
                'body.password',
                'body.refreshToken',
              ],
              remove: true,
            },
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
      imports: [RedisThrottlerModule],
      inject: [ConfigService, RedisThrottlerStorage],
      useFactory: (config: ConfigService, storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            ttl: config.get<number>('rateLimit.ttl') || 60,
            limit: config.get<number>('rateLimit.limit') || 100,
          },
        ],
        storage,
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

    QueuesModule,

    EventEmitterModule.forRoot(),

    FirebaseModule,
    RedisThrottlerModule,
    DatabaseModule,
    MailModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ContentModule,
    EngagementModule,
    FeedModule,
    StreamingModule,
    LiveBroadcastModule,
    EntitlementsModule,
    BillingModule,
    StreamChatModule,
    CommunitiesModule,
    CoursesModule.register(),
    CreatorResourcesModule,
    GamificationModule.register(),
    ChannelPointsModule.register(),
    FraudDetectionModule,
    ReferralModule,
    AccessSessionsModule,
    DirectMessagesModule,
    ...(shouldLoadWorkersModule() ? [WorkersModule] : []),
    AdminModule,
    PlaylistsModule,
    NotificationsModule,
    GatewayModule,
    SearchModule,
    ReportsModule,
    AccountStrikesModule,
    CopyrightModule,
    AnalyticsModule,
    PlatformModule,
    MonetizationModule,
  ],

  controllers: [HealthController, MetricsController],
  providers: [
    BullmqMetricsService,
    ...sentryFilterProviders(),
    EmailVerifiedGuard,
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ClsUserInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Throttle immediately after auth identifies the request, before the
    // Roles/ConsumerOnly/Permissions chain spends CPU on a request that's
    // about to be rejected anyway (audit finding, forge-performance.md).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ConsumerOnlyGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useExisting: EmailVerifiedGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ClsMiddleware).forRoutes('*');
  }
}
