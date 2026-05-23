/**
 * E2E 테스트 부트스트랩 헬퍼
 *  - globalSetup이 DB를 준비함
 *  - 이 함수는 NestJS Application 인스턴스를 생성
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';

// 환경 변수는 jest.global-setup.ts 에서 이미 설정됨
// 여기서도 한 번 더 설정 (워커마다 process가 새로 뜨므로)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./test.db';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-min-32-chars-aaa';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-min-32-chars-bbb';
process.env.OTP_DEMO_CODE = process.env.OTP_DEMO_CODE || '123456';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

let app: INestApplication;

export async function getTestApp(): Promise<INestApplication> {
  if (app) return app;
  // AppModule을 동적으로 require하여 환경 변수가 이미 설정된 후 로드되도록 보장
  const { AppModule } = await import('../src/app.module');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication({
    logger: process.env.TEST_VERBOSE === '1' ? ['error', 'warn'] : false,
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

export async function closeTestApp() {
  if (app) {
    await app.close();
    app = undefined as any;
  }
}
