/* ============================================================
   PASS 통합 점검 스크립트
   pass-api.js 를 실제 백엔드에 연결해 전체 흐름을 자동 검증한다.

   사용법:
     1) 백엔드 실행:  npm run start   (다른 터미널)
     2) 점검 실행:     node integration-check.cjs

   가입 → 로그인 → 포스트/피드/좋아요/댓글 → 관계 → 채팅 → WebSocket
   순서로 20개 항목을 점검한다. 모두 통과하면 exit code 0.
   ============================================================ */
const path = require('path');

function makeStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    clear: () => m.clear(),
  };
}
global.localStorage = makeStorage();
global.sessionStorage = makeStorage();
try { global.io = require('socket.io-client').io; } catch (e) { /* WebSocket 점검 생략 */ }

// pass-api.js 는 ../frontend/pass-api.js 에 위치
require(path.join(__dirname, '..', 'frontend', 'pass-api.js'));
const API = global.PassAPI;

let pass = 0, fail = 0;
const fails = [];
async function check(name, fn) {
  try { const r = await fn(); console.log('  OK  ', name); pass++; return r; }
  catch (e) { console.log('  FAIL', name, '->', e.message); fail++; fails.push(name + ': ' + e.message); return null; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assert failed'); }
const setActive = t => global.localStorage.setItem('pass_tokens', JSON.stringify(t));

(async () => {
  const ts = Date.now();
  const tail8 = String(ts).slice(-8);
  const A = { email: `a${ts}@chon.ai`, phone: `010${tail8}`, name: '점검A' };
  const B = { email: `b${ts}@chon.ai`, phone: `011${tail8}`, name: '점검B' };
  let aId, bId, tokA, tokB, postId, relId, convId;

  console.log('\n-- 1. 가입 (OTP -> signup) --');
  await check('A requestOtp(sms,register)', async () => {
    const r = await API.auth.requestOtp('sms', A.phone, 'register');
    assert(r && r.ok, 'ok 아님'); A._otp = r.demoCode; assert(A._otp, 'demoCode 없음 (NODE_ENV=production?)');
  });
  await check('A signup', async () => {
    const r = await API.auth.signup(A.email, A.phone, A._otp, A.name);
    assert(r && r.ok && r.userId, 'userId 없음'); aId = r.userId;
  });
  await check('B requestOtp + signup', async () => {
    const o = await API.auth.requestOtp('sms', B.phone, 'register');
    const r = await API.auth.signup(B.email, B.phone, o.demoCode, B.name);
    assert(r && r.userId, 'B signup 실패'); bId = r.userId;
  });

  console.log('\n-- 2. 로그인 (email-otp) --');
  await check('A login email-otp', async () => {
    const o = await API.auth.requestOtp('email', A.email, 'login');
    const r = await API.auth.loginEmailOtp(A.email, o.demoCode);
    assert(r.accessToken && r.refreshToken, 'tokens 없음');
    assert(r.user && r.user.email === A.email, 'user.email 불일치');
    API.saveSession(r); tokA = API.getTokens();
  });
  await check('B login email-otp', async () => {
    const o = await API.auth.requestOtp('email', B.email, 'login');
    const r = await API.auth.loginEmailOtp(B.email, o.demoCode);
    assert(r.accessToken, 'B tokens 없음');
    tokB = { accessToken: r.accessToken, refreshToken: r.refreshToken };
  });

  console.log('\n-- 3. 인증 사용자 정보 --');
  setActive(tokA);
  await check('auth.me()', async () => {
    const r = await API.auth.me();
    assert(r.ok && r.user && r.user.sub === aId, 'sub 불일치');
  });
  await check('users.me()', async () => {
    const r = await API.users.me();
    assert(r.email === A.email, 'email 불일치');
  });

  console.log('\n-- 4. 포스트 / 피드 / 좋아요 / 댓글 --');
  await check('posts.create', async () => {
    const r = await API.posts.create('통합점검 포스트 ' + ts, 'public');
    postId = r && (r.id || (r.post && r.post.id));
    assert(postId, 'post id 없음');
  });
  await check('posts.feed(self) 포스트 포함', async () => {
    const r = await API.posts.feed('self');
    const arr = Array.isArray(r) ? r : (r.posts || r.items || []);
    assert(Array.isArray(arr) && arr.some(p => p.id === postId), '생성 포스트 미포함');
  });
  await check('posts.toggleLike', async () => {
    const r = await API.posts.toggleLike(postId);
    assert(r !== undefined, 'like 응답 없음');
  });
  await check('posts.addComment + comments', async () => {
    await API.posts.addComment(postId, '점검 댓글');
    const r = await API.posts.comments(postId);
    const arr = Array.isArray(r) ? r : (r.items || r.comments);
    assert(Array.isArray(arr) && arr.length >= 1, '댓글 미포함');
  });

  console.log('\n-- 5. 관계 (friend 요청 -> 수락) --');
  await check('A -> B friend 요청', async () => {
    const r = await API.relations.requestRel({ toUserId: bId, kind: 'friend', subtype: '1' });
    relId = r && r.id;
    assert(relId, 'relation id 없음');
  });
  setActive(tokB);
  await check('B incoming 에 요청 표시', async () => {
    const r = await API.relations.incoming();
    const arr = Array.isArray(r) ? r : (r.items || []);
    assert(arr.some(x => x.id === relId), 'incoming 미포함');
  });
  await check('B respond(confirm)', async () => {
    const r = await API.relations.respond(relId, 'confirm');
    assert(r, 'respond 실패');
  });
  await check('B relations.mine(friend,confirmed)', async () => {
    const r = await API.relations.mine('friend', 'confirmed');
    const arr = Array.isArray(r) ? r : (r.items || []);
    assert(arr.length >= 1, 'confirmed friend 없음');
  });

  console.log('\n-- 6. 채팅 (REST) --');
  setActive(tokA);
  await check('chat.open(B)', async () => {
    const r = await API.chat.open(bId);
    convId = r && (r.id || (r.conversation && r.conversation.id));
    assert(convId, 'conversation id 없음');
  });
  await check('chat.send + messages', async () => {
    await API.chat.send(convId, '통합점검 메시지');
    const r = await API.chat.messages(convId);
    const arr = Array.isArray(r) ? r : (r.messages || r.items);
    assert(Array.isArray(arr) && arr.length >= 1, '메시지 미포함');
  });
  await check('chat.list (B)', async () => {
    setActive(tokB);
    const r = await API.chat.list();
    const arr = Array.isArray(r) ? r : (r.items || r.conversations);
    assert(Array.isArray(arr) && arr.length >= 1, '대화방 없음');
  });
  await check('chat.read', async () => { await API.chat.read(convId); });

  console.log('\n-- 7. WebSocket (socket.io /chat) --');
  if (!global.io) {
    console.log('  SKIP socket.io-client 미설치');
  } else {
    await check('connectChat 연결', async () => {
      setActive(tokA);
      const socket = API.connectChat();
      await new Promise((res, rej) => {
        const t = setTimeout(() => rej(new Error('연결 타임아웃 3s')), 3000);
        socket.on('connect', () => { clearTimeout(t); res(); });
        socket.on('connect_error', e => { clearTimeout(t); rej(new Error('connect_error: ' + e.message)); });
      });
      socket.disconnect();
    });
  }

  console.log('\n-- 8. 그래프 (가계도/모임/학급) --');
  setActive(tokA);
  await check('graphs.save(family)', async () => {
    const r = await API.graphs.save('family', { people: [{ id: 'p1', name: '할머니', confirmed: false }], ts });
    assert(r && r.ok, 'save 실패');
  });
  await check('graphs.get(family) 라운드트립', async () => {
    const r = await API.graphs.get('family');
    assert(r && r.data && Array.isArray(r.data.people) && r.data.people[0].name === '할머니', 'data 불일치');
  });
  await check('graphs.get(group) 빈 그래프 data:null', async () => {
    const r = await API.graphs.get('group');
    assert(r && r.data === null, 'data null 아님');
  });
  await check('graphs 잘못된 kind 거부', async () => {
    let rejected = false;
    try { await API.graphs.save('badkind', {}); } catch (e) { rejected = true; }
    assert(rejected, 'badkind 거부 안 됨');
  });

  console.log('\n======== 결과: ' + pass + ' 통과 / ' + fail + ' 실패 ========');
  if (fail) { console.log('실패 항목:'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('치명적 오류:', e && e.message ? e.message : e); process.exit(2); });
