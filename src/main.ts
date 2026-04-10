import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './common/cors-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  });

  // Swagger — only available when ENABLE_SWAGGER is set (defaults to on in dev)
  const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Zenno Backend API')
      .setDescription('API documentation for Zenno - Firebase Token Verification')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('User', 'User profile endpoints')
      .addTag('Chat', 'Direct messages (REST + WebSocket /chat)')
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
