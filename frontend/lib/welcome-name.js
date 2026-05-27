/**
 * PASS — 환영 배너 이름 채우기 (공통)
 *
 * 사용법: 페이지 하단(</body> 직전)에 한 줄 추가
 *   <script src="<상대경로>/lib/welcome-name.js"></script>
 *
 * 모든 페이지의 .welcome-user 요소를 같은 사용자명으로 채움.
 * 우선순위: passSelfId.name (CHON ID 신분증) > passUser.name > 이메일 핸들 > '사용자'
 *
 * 신분증을 갱신하면(passSelfId 저장) 다른 페이지의 환영 배너도
 * storage 이벤트를 통해 자동으로 업데이트됨.
 */
(function () {
  function resolveName() {
    try {
      const raw = localStorage.getItem('passSelfId');
      if (raw) {
        const id = JSON.parse(raw);
        if (id && id.name) return id.name;
      }
    } catch (e) {}
    try {
      const u = JSON.parse(localStorage.getItem('passUser') || '{}');
      if (u && u.name) return u.name;
      if (u && u.email) return u.email.split('@')[0];
    } catch (e) {}
    return '사용자';
  }

  function apply() {
    const name = resolveName();
    document.querySelectorAll('.welcome-user').forEach((el) => {
      el.textContent = name;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  // 다른 탭에서 ID나 사용자 정보가 바뀌면 즉시 반영
  window.addEventListener('storage', (e) => {
    if (e.key === 'passSelfId' || e.key === 'passUser') apply();
  });
})();
