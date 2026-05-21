import './instrument';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe, RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  const logger = app.get(Logger);
  logger.log('FORGE worker process started (BullMQ consumers; no HTTP listener)');
}

async function bootstrap() {
  if (process.env.WORKER_ONLY === 'true') {
    await bootstrapWorker();
    return;
  }

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
    logger: false,
  });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3001;
  const nodeEnv = configService.get<string>('nodeEnv');
  const logger = app.get(Logger);

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'metrics', method: RequestMethod.ALL }],
  });

  app.use(helmet());

  const prodOrigins = [
    process.env.WEB_URL,
    process.env.ADMIN_URL,
    'https://forgestudios.net',
    'https://www.forgestudios.net',
    'https://admin.forgestudios.net',
  ]
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter((o) => o.length > 0)
    .filter((o, i, arr) => arr.indexOf(o) === i);
  if (nodeEnv === 'production' && prodOrigins.length === 0) {
    logger.warn('WEB_URL / ADMIN_URL unset — set both for browser CORS in production.');
  }

  app.enableCors({
    origin: nodeEnv === 'production' ? (prodOrigins.length > 0 ? prodOrigins : []) : '*',
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

  await app.listen(port);
  logger.log(`FORGE API running on: http://localhost:${port}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap', err);
  process.exit(1);
});
