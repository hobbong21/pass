import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // CORS — 프론트 HTML 파일에서 직접 호출 가능하도록
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN') || '*',
    credentials: true,
  });

  // 전역 검증 파이프
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`🚀 PASS Backend running on http://localhost:${port}/api`);
}
bootstrap();
