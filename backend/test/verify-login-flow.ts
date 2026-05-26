/**
 * 로그인 흐름 검증 — 백엔드 API가 프론트엔드 흐름의 각 단계에서 기대한 응답을 주는지
 *   1. 비밀번호 로그인 → 토큰
 *   2. setupPin → 디바이스 PIN 등록
 *   3. loginPin → PIN-only 로그인
 *   4. /me → 토큰 검증
 */
const BASE = 'http://localhost:3000/api';

async function step(name: string, fn: () => Promise<any>) {
  process.stdout.write(`  ${name}... `);
  try {
    const r = await fn();
    console.log('✅', r ? `(${JSON.stringify(r).slice(0, 80)})` : '');
    return r;
  } catch (e: any) {
    console.log('❌', e.message);
    throw e;
  }
}

async function api(path: string, opts: any = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${res.status} ${body?.message || text}`);
  return body;
}

async function main() {
  const email = 'demo@chon.ai';
  const password = 'chon1234';
  const deviceId = 'verify-flow-' + Date.now();
  const pin = '987654';

  console.log('\n📋 시나리오: 비밀번호 로그인 → PIN 설정 → PIN 로그인 → /me\n');

  const loginResp = await step('1. POST /auth/login/password', () =>
    api('/auth/login/password', { body: { email, password, deviceId } }));

  const token = loginResp.accessToken;
  await step('2. POST /auth/pin/setup (JWT 필요)', () =>
    api('/auth/pin/setup', { body: { deviceId, pin }, token }));

  await step('3. POST /auth/login/pin (이 디바이스 + PIN)', () =>
    api('/auth/login/pin', { body: { deviceId, pin } }));

  await step('4. GET /auth/me (JWT)', () =>
    api('/auth/me', { method: 'GET', token }));

  console.log('\n✅ 모든 단계 통과 — 프론트엔드 흐름이 정상 동작할 수 있는 백엔드 상태\n');
  process.exit(0);
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
