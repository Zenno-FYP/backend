import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './common/cors-origins';

async function bootstrap() {
  // @nestjs/schedule ≥ 4 calls crypto.randomUUID() as a global, which only
  // became available on globalThis in Node 19+. Polyfill for Node 18 servers.
  if (typeof (globalThis as any).crypto === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    (globalThis as any).crypto = require('node:crypto').webcrypto;
  }

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = parseCorsOrigins();
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  // Swagger — only available when ENABLE_SWAGGER is set (defaults to on in dev)
  const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Zenno Backend API')
      .setDescription(
        [
          'REST API for Zenno (web, mobile, desktop agent).',
          '',
          '**Authentication:** Most routes require a Firebase ID token in `Authorization: Bearer <token>`.',
          'Click **Authorize**, paste the raw token (no `Bearer` prefix in the Swagger UI field unless your client adds it).',
          '',
          '**Admin:** `/api/v1/admin/*` requires the same Firebase token **and** `users.isAdmin === true` in MongoDB.',
          '',
          '**WebSocket chat:** Real-time messaging uses Socket.IO namespace `/chat` (not listed as REST operations here).',
        ].join('\n'),
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID token (same token the website/mobile send as Bearer)',
        },
        'firebase',
      )
      .addTag('User', 'Current user profile (GET/PATCH /user/me, photo upload)')
      .addTag('Dashboard', 'Analytics: metrics, tool usage, projects, peers, public profiles')
      .addTag('Activity/Sync', 'Desktop agent batch sync of activity aggregates')
      .addTag('Agent', 'Zenno agent preferences and nudge sync (desktop + website)')
      .addTag('Chat', 'Direct messages REST: inbox, messages, read receipts, report conversation')
      .addTag('Notifications', 'Push device registration, in-app notification inbox, preferences')
      .addTag('Admin', 'Admin dashboard: aggregate stats, users table, chat report moderation')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  if (enableSwagger) {
    console.log(`Swagger API docs: http://localhost:${port}/api/docs`);
  }
}
bootstrap();
