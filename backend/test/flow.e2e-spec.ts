/**
 * 통합 플로우 E2E
 *   - 2명의 사용자 가입
 *   - 친구 관계 요청·승인
 *   - 포스트 작성 + 피드 가시성
 *   - 1:1 대화방 + 메시지
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, closeTestApp } from './test-setup';

describe('🌐 통합 플로우 (E2E)', () => {
  let app: INestApplication;
  let httpServer: any;

  const userA = { email: 'alice@chon.ai', phone: '010-1111-0000' };
  const userB = { email: 'bob@chon.ai',   phone: '010-2222-0000' };
  let tokenA: string, tokenB: string;
  let idA: string, idB: string;

  beforeAll(async () => {
    app = await getTestApp();
    httpServer = app.getHttpServer();

    // 2명 가입 + 비밀번호 로그인
    const password = 'chon1234';
    for (const u of [userA, userB]) {
      await request(httpServer).post('/api/auth/otp/request')
        .send({ channel: 'email', target: u.email, purpose: 'register' }).expect(200);
      await new Promise(r => setTimeout(r, 60));
      const signup = await request(httpServer).post('/api/auth/signup')
        .send({ email: u.email, phone: u.phone, password, otp: '123456', name: u.email.split('@')[0] });
      expect(signup.status).toBe(201);

      const login = await request(httpServer).post('/api/auth/login/password')
        .send({ email: u.email, password, deviceId: `dev-${u.email}` });
      expect(login.status).toBe(200);
      if (u === userA) { tokenA = login.body.accessToken; idA = login.body.user.id; }
      else { tokenB = login.body.accessToken; idB = login.body.user.id; }
    }
  });
  afterAll(async () => { await closeTestApp(); });

  describe('Users', () => {
    it('GET /users/me — A 프로필', async () => {
      const res = await request(httpServer).get('/api/users/me').set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(userA.email);
    });

    it('PATCH /users/me — 이름 변경', async () => {
      const res = await request(httpServer)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: 'Alice 변경됨' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Alice 변경됨');
    });
  });

  describe('Contacts', () => {
    it('연락처 동기화 → 가입자 매칭', async () => {
      const res = await request(httpServer)
        .post('/api/contacts/sync')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          contacts: [
            { phone: userB.phone, displayName: 'Bob 친구' },
            { phone: '010-9999-9999', displayName: '미가입자' },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.total).toBe(2);
      expect(res.body.matched).toBe(1);
    });
  });

  describe('Relations', () => {
    let relationId: string;

    it('A → B 친구 요청', async () => {
      const res = await request(httpServer)
        .post('/api/relations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ toUserId: idB, kind: 'friend' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('pending');
      relationId = res.body.id;
    });

    it('B 수신함에서 요청 확인', async () => {
      const res = await request(httpServer).get('/api/relations/incoming').set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('B가 confirm → 양방향 confirmed', async () => {
      const res = await request(httpServer)
        .patch(`/api/relations/${relationId}/respond`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ action: 'confirm' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');

      // A 입장에서도 confirmed friend 1명
      const aRel = await request(httpServer)
        .get('/api/relations/me?kind=friend&status=confirmed')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(aRel.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Posts', () => {
    let postId: string;

    it('A가 포스트 작성', async () => {
      const res = await request(httpServer)
        .post('/api/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Hello from Alice', audience: 'friends' });
      expect(res.status).toBe(201);
      postId = res.body.id;
    });

    it('B 피드에서 A의 포스트 가시', async () => {
      const res = await request(httpServer)
        .get('/api/posts/feed?filter=all')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(200);
      const found = res.body.posts.find((p: any) => p.id === postId);
      expect(found).toBeDefined();
      expect(found.hop).toBe(1);
    });

    it('B가 좋아요 토글', async () => {
      const res = await request(httpServer)
        .post(`/api/posts/${postId}/like`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(res.status).toBe(201);
      expect(res.body.liked).toBe(true);
    });

    it('B가 댓글 작성', async () => {
      const res = await request(httpServer)
        .post(`/api/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: '좋은 글이에요!' });
      expect(res.status).toBe(201);
      expect(res.body.content).toBe('좋은 글이에요!');
    });

    it('포스트 삭제는 작성자만', async () => {
      const wrong = await request(httpServer)
        .delete(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(wrong.status).toBe(403);

      const ok = await request(httpServer)
        .delete(`/api/posts/${postId}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(ok.status).toBe(200);
    });
  });

  describe('Chat', () => {
    let convId: string;

    it('1:1 대화방 열기 (없으면 생성)', async () => {
      const res = await request(httpServer)
        .post('/api/chat/conversations/open')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: idB });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      convId = res.body.id;
    });

    it('같은 상대로 열면 동일 conv 반환 (멱등)', async () => {
      const res = await request(httpServer)
        .post('/api/chat/conversations/open')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ userId: idB });
      expect(res.body.id).toBe(convId);
    });

    it('A가 메시지 전송 → B 대화방 목록의 안 읽음 +1', async () => {
      await request(httpServer)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: '안녕 Bob!' })
        .expect(201);

      const list = await request(httpServer).get('/api/chat/conversations').set('Authorization', `Bearer ${tokenB}`);
      const conv = list.body.find((c: any) => c.id === convId);
      expect(conv.unread).toBeGreaterThanOrEqual(1);
      expect(conv.lastMessage).toContain('안녕 Bob');
    });

    it('B가 메시지 조회 + 읽음 처리 → unread=0', async () => {
      const msgs = await request(httpServer)
        .get(`/api/chat/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(msgs.body.messages.length).toBeGreaterThanOrEqual(1);

      await request(httpServer)
        .post(`/api/chat/conversations/${convId}/read`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(201);

      const list = await request(httpServer).get('/api/chat/conversations').set('Authorization', `Bearer ${tokenB}`);
      const conv = list.body.find((c: any) => c.id === convId);
      expect(conv.unread).toBe(0);
    });

    it('타인 대화방 접근 차단', async () => {
      // userC 생성 후 convId에 접근 시도
      const userC = { email: 'carol@chon.ai', phone: '010-3333-0000' };
      const passwordC = 'chon1234';
      await request(httpServer).post('/api/auth/otp/request')
        .send({ channel: 'email', target: userC.email, purpose: 'register' });
      await new Promise(r => setTimeout(r, 60));
      await request(httpServer).post('/api/auth/signup')
        .send({ email: userC.email, phone: userC.phone, password: passwordC, otp: '123456' });
      const login = await request(httpServer).post('/api/auth/login/password')
        .send({ email: userC.email, password: passwordC, deviceId: 'devC' });
      const tokenC = login.body.accessToken;

      const res = await request(httpServer)
        .get(`/api/chat/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tokenC}`);
      expect(res.status).toBe(403);
    });
  });
});
