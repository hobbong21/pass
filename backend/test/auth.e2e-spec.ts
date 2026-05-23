import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, closeTestApp } from './test-setup';

describe('🔐 Auth (E2E)', () => {
  let app: INestApplication;
  let httpServer: any;
  const phone = '010-9876-5432';
  const email = 'tester@chon.ai';

  beforeAll(async () => {
    app = await getTestApp();
    httpServer = app.getHttpServer();
  });
  afterAll(async () => { await closeTestApp(); });

  describe('회원가입 플로우', () => {
    it('register 목적 OTP를 요청한다', async () => {
      const res = await request(httpServer)
        .post('/api/auth/otp/request')
        .send({ channel: 'sms', target: phone, purpose: 'register' });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.demoCode).toBe('123456');
    });

    it('잘못된 코드로 가입 시 실패한다', async () => {
      const res = await request(httpServer)
        .post('/api/auth/signup')
        .send({ email, phone, otp: '000000', name: 'Tester' });
      expect(res.status).toBe(400);
    });

    it('정상 OTP로 가입한다', async () => {
      // OTP 다시 요청 (이전 코드 attempts 증가했을 수 있음)
      await request(httpServer)
        .post('/api/auth/otp/request')
        .send({ channel: 'sms', target: phone, purpose: 'register' })
        .expect(200);
      await new Promise(r => setTimeout(r, 100));

      const res = await request(httpServer)
        .post('/api/auth/signup')
        .send({ email, phone, otp: '123456', name: 'Tester' });
      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.email).toBe(email);
    });

    it('이미 가입된 이메일로 다시 가입 시 409', async () => {
      // 새 OTP
      await request(httpServer)
        .post('/api/auth/otp/request')
        .send({ channel: 'sms', target: phone, purpose: 'register' });
      await new Promise(r => setTimeout(r, 100));

      const res = await request(httpServer)
        .post('/api/auth/signup')
        .send({ email, phone, otp: '123456' });
      expect(res.status).toBe(409);
    });
  });

  describe('이메일 OTP 로그인', () => {
    let accessToken: string;
    let refreshToken: string;

    it('OTP 발급 후 로그인 성공', async () => {
      await request(httpServer)
        .post('/api/auth/otp/request')
        .send({ channel: 'email', target: email, purpose: 'login' })
        .expect(200);
      await new Promise(r => setTimeout(r, 100));

      const res = await request(httpServer)
        .post('/api/auth/login/email-otp')
        .send({ email, code: '123456', deviceId: 'test-device-1' });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('JWT로 /me 접근 가능', async () => {
      const res = await request(httpServer)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(email);
    });

    it('JWT 없이 /me는 401', async () => {
      const res = await request(httpServer).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('Refresh 토큰 회전', async () => {
      const res = await request(httpServer)
        .post('/api/auth/refresh')
        .send({ refreshToken, deviceId: 'test-device-1' });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      // 새 토큰이 발급되어야 함 (회전)
      expect(res.body.refreshToken).not.toBe(refreshToken);
    });
  });

  describe('PIN 2FA', () => {
    let accessToken: string;

    beforeAll(async () => {
      // 신선한 로그인
      await request(httpServer)
        .post('/api/auth/otp/request')
        .send({ channel: 'email', target: email });
      await new Promise(r => setTimeout(r, 100));
      const res = await request(httpServer)
        .post('/api/auth/login/email-otp')
        .send({ email, code: '123456', deviceId: 'pin-device' });
      accessToken = res.body.accessToken;
    });

    it('사소한 PIN (123456) 등록 거부', async () => {
      const res = await request(httpServer)
        .post('/api/auth/pin/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deviceId: 'pin-device', pin: '123456' });
      expect(res.status).toBe(400);
    });

    it('정상 PIN 등록 → PIN 로그인 성공', async () => {
      const setup = await request(httpServer)
        .post('/api/auth/pin/setup')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ deviceId: 'pin-device', pin: '847291' });
      expect(setup.status).toBe(200);

      const login = await request(httpServer)
        .post('/api/auth/login/pin')
        .send({ deviceId: 'pin-device', pin: '847291' });
      expect(login.status).toBe(200);
      expect(login.body.user.email).toBe(email);
    });

    it('잘못된 PIN → 401', async () => {
      const res = await request(httpServer)
        .post('/api/auth/login/pin')
        .send({ deviceId: 'pin-device', pin: '000000' });
      expect(res.status).toBe(401);
    });
  });
});
