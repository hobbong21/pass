/**
 * Jest globalSetup — 모든 워커가 시작되기 전에 한 번 실행.
 * 테스트 DB 파일을 prisma db push로 초기화.
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup() {
  const cwd = path.resolve(__dirname, '..');
  const dbPath = path.join(cwd, 'test.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const journal = path.join(cwd, 'test.db-journal');
  if (fs.existsSync(journal)) fs.unlinkSync(journal);

  process.env.DATABASE_URL = 'file:./test.db';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-aaa';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-bbb';
  process.env.OTP_DEMO_CODE = '123456';
  process.env.NODE_ENV = 'test';

  console.log('\n📦 테스트 DB 초기화 중 (file:./test.db)...');
  try {
    // --force-reset: 기존 모든 테이블 drop + 새로 생성 (가장 확실)
    execSync('npx prisma db push --skip-generate --accept-data-loss --force-reset', {
      cwd,
      env: { ...process.env, DATABASE_URL: 'file:./test.db' },
      stdio: 'pipe',
    });
    console.log('✅ 테스트 DB 준비 완료\n');
  } catch (e: any) {
    console.error('❌ prisma db push 실패:');
    console.error(e.stderr?.toString() || e.message);
    throw e;
  }
}
