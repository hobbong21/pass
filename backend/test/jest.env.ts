/**
 * Jest setupFiles — import 전에 환경 변수를 설정합니다.
 * Jest가 모듈을 로드하기 전에 실행됩니다.
 */
process.env.DATABASE_URL = 'file:./test.db';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-aaa';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-bbb';
process.env.OTP_DEMO_CODE = '123456';
process.env.NODE_ENV = 'test';

// 테스트 DB를 prisma db push로 동기화 (마이그레이션 파일 무관)
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const cwd = path.resolve(__dirname, '..');
const dbFile = path.join(cwd, 'test.db');
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
const journalFile = path.join(cwd, 'test.db-journal');
if (fs.existsSync(journalFile)) fs.unlinkSync(journalFile);

try {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd,
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
} catch (e: any) {
  console.error('prisma db push 실패:', e.stderr?.toString() || e.message);
}
