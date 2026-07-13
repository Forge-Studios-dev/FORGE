import './instrument';
import 'reflect-metadata';
import { createServer } from 'http';
import { NestFactory } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { validateProductionConfig } from './config/validate-production-config';
import { httpMetricsMiddleware } from './common/metrics/http-metrics.middleware';
import { devCorsOrigins, productionCorsOrigins } from './config/cors-origins';

async function bootstrapWorker() {
  // Use visible logging during DI so crashes appear in flyctl logs.
  // bufferLogs=false ensures errors emit immediately even if DI fails mid-way.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
    bufferLogs: false,
  });
  validateProductionConfig(app.get(ConfigService));
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  const logger = app.get(Logger);
  logger.log('FORGE worker process started (BullMQ consumers; no HTTP listener)');

  // MED-08: a bare http.Server (not routed through Nest/Express) purely so
  // Fly has a real functional liveness check for the worker, instead of only
  // checking machine state. Reachable only after the Nest application
  // context above has fully booted (DI + config validation succeeded), so
  // its absence is itself the correct failure signal for Fly to act on.
  const port = Number(process.env.PORT) || 3001;
  createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(port, () => logger.log(`Worker health endpoint listening on :${port}`));
}

async function bootstrap() {
  if (process.env.WORKER_ONLY === 'true') {
    await bootstrapWorker();
    return;
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: false,
    logger: ['error', 'warn', 'log'],
  });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  validateProductionConfig(configService);
  const port = configService.get<number>('port') || 3001;
  const nodeEnv = configService.get<string>('nodeEnv');
  const logger = app.get(Logger);

  app.enableShutdownHooks();
  const http = app.getHttpAdapter().getInstance();
  http.set('trust proxy', 1);

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'metrics', method: RequestMethod.ALL }],
  });

  app.use(cookieParser());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));
  app.use(helmet());
  app.use(httpMetricsMiddleware);

  const prodOrigins = productionCorsOrigins();
  if (nodeEnv === 'production' && prodOrigins.length === 0) {
    throw new Error('Production requires WEB_URL and/or ADMIN_URL for browser CORS.');
  }

  app.enableCors({
    origin: nodeEnv === 'production' ? (prodOrigins.length > 0 ? prodOrigins : []) : devCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FORGE API')
      .setDescription('FORGE – Live Creator Platform API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }

  await app.listen(port, '0.0.0.0');
  logger.log(`FORGE API running on: http://0.0.0.0:${port}/api/v1`);
}

bootstrap().catch((err) => {
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
  process.stderr.write(`Fatal error during bootstrap: ${message}\n`);
  console.error(`Fatal error during bootstrap: ${message}`);
  process.exit(1);
});
