/**
 * PASS — 인증 가드 (공통)
 *
 * 사용법: 보호 페이지의 <head>에 한 줄만 추가
 *   <script src="<상대경로>/lib/auth-guard.js" data-require="login"></script>
 *
 * data-require 옵션:
 *   "login"   (기본) 로그인 필수 — passUser 없으면 login.html로
 *   "self-id" 본인 ID 생성 후 진입 — selfIdCreated='1' 필요. 신규 사용자는 self-id.html로
 *
 * paint 전 동기 실행이라 깜빡임 없음. localStorage 차단 환경에선 가드 비활성(통과).
 */
(function () {
  try {
    const me = document.currentScript;
    const requirement = (me && me.getAttribute('data-require')) || 'login';

    // login.html 까지의 상대 경로 계산 — auth-guard.js가 /lib/ 안에 있으므로
    // 현재 페이지 위치에 따라 ../auth/login.html 또는 ./auth/login.html
    const scriptSrc = me ? me.src : '';
    const libIdx = scriptSrc.lastIndexOf('/lib/');
    const root = libIdx >= 0 ? scriptSrc.slice(0, libIdx) : '';
    const loginUrl = root + '/auth/login.html';
    const selfIdUrl = root + '/auth/self-id.html';

    // === 개발/테스트 모드 바이패스 ===
    // URL에 ?dev=1 이 있거나 localStorage.pass_dev_mode='1' 인 경우,
    // 데모 세션을 자동 주입하고 가드를 건너뜀.
    // 모든 보호 페이지에 ?dev=1 만 붙이면 단독 테스트 가능.
    let isDev = false;
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('dev') === '1') {
        localStorage.setItem('pass_dev_mode', '1');
        isDev = true;
      } else if (localStorage.getItem('pass_dev_mode') === '1') {
        isDev = true;
      }
    } catch (_) {}

    if (isDev) {
      // 데모 세션이 없으면 자동 주입
      try {
        if (!localStorage.getItem('passUser')) {
          localStorage.setItem('passUser', JSON.stringify({
            email: 'demo@chon.ai',
            name: '홍길순',
            isNew: false,
            loginAt: Date.now(),
          }));
        }
        // 튜토리얼은 건너뛴 것으로 처리
        if (!localStorage.getItem('pass_tutorial_seen')) {
          localStorage.setItem('pass_tutorial_seen', 'true');
        }
      } catch (_) {}
      return; // 가드 종료 — 페이지 렌더 진행
    }

    let user = null;
    try {
      const raw = localStorage.getItem('passUser');
      user = raw ? JSON.parse(raw) : null;
    } catch (_) {}

    // 1) 로그인 안 됨 → login.html
    if (!user || !user.email) {
      location.replace(loginUrl);
      return;
    }

    // 2) self-id 생성 미완료 신규 사용자 → self-id.html
    //    (단, 본인이 이미 self-id.html 위에 있다면 통과)
    if (requirement === 'login') {
      const selfIdDone = localStorage.getItem('selfIdCreated') === '1';
      const onSelfId = location.pathname.endsWith('/self-id.html');
      if (user.isNew && !selfIdDone && !onSelfId) {
        location.replace(selfIdUrl);
        return;
      }
    }
  } catch (e) {
    // 가드 자체에서 예외가 생기면 그대로 진행 — 화면을 막지 않음
    // 콘솔로만 통지
    if (window && window.console) console.warn('[auth-guard]', e);
  }
})();
