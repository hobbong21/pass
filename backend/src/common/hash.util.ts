import * as crypto from 'crypto';

/**
 * SHA-256 해시 — OTP 코드, 리프레시 토큰, 연락처 전화번호 등에 사용
 * 평문 미저장 원칙
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * E.164 정규화 — 한국 휴대폰 표기를 통일
 *   '010-1234-5678', '01012345678', '+821012345678' → '+821012345678'
 */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s-]/g, '');
  if (p.startsWith('+82')) return p;
  if (p.startsWith('82')) return '+' + p;
  if (p.startsWith('0')) return '+82' + p.substring(1);
  return p;
}

export function hashPhone(raw: string): string {
  return sha256(normalizePhone(raw));
}

/**
 * 6자리 랜덤 OTP 코드 생성
 * NODE_ENV=development 이고 OTP_DEMO_CODE 가 있으면 그 값 반환
 */
export function generateOtpCode(demoCode?: string): string {
  if (demoCode && process.env.NODE_ENV !== 'production') return demoCode;
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}
