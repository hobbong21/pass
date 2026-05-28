/**
 * PASS — 공용 채팅 팝업 (1:1 인증된 인원 채팅 시뮬레이션)
 *
 * 사용법:
 *   <script src="<상대경로>/lib/chat-popup.js"></script>
 *
 *   // 어디서든 호출 가능
 *   PassChat.open({
 *     name: '홍길순',
 *     initial: '홍',          // 옵션: 미지정 시 name 첫 글자
 *     kind: 'family',          // 'family' (초록) | 'club' (파랑) | 'contact' (회색)
 *     body: '안녕하세요!',     // 시드 메시지 (옵션)
 *     ts: Date.now(),          // 시드 메시지 시각 (옵션, 미지정 시 현재 시각)
 *     status: '인증된 가족',    // 헤더 상태 텍스트 (옵션, kind에서 자동 결정)
 *   });
 *   PassChat.close();
 *
 * 디자인:
 *   - 우측에서 슬라이드 인하는 풀스크린 채팅
 *   - 백 버튼/ESC/백드롭 클릭으로 닫힘
 *   - 보낸 메시지는 휘발성 (데모용 — 백엔드 연동 시 영속화)
 */
(function () {
  if (window.__passChatPopupInit) return;
  window.__passChatPopupInit = true;

  // ============================================================
  // CSS 주입
  // ============================================================
  const CSS = `
  .pc-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0);
    z-index: 280;
    pointer-events: none;
    transition: background 0.22s ease;
  }
  .pc-overlay.visible {
    background: rgba(15, 23, 42, 0.35);
    pointer-events: auto;
  }
  .pc-screen {
    position: fixed;
    top: 0; right: 0;
    width: 100%;
    max-width: 480px;
    height: 100%;
    height: 100dvh;
    background: white;
    z-index: 281;
    display: flex;
    flex-direction: column;
    box-shadow: -8px 0 30px rgba(0,0,0,0.18);
    transform: translateX(100%);
    transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .pc-screen.visible { transform: translateX(0); }
  @media (min-width: 768px) {
    .pc-overlay.visible { background: rgba(15, 23, 42, 0.5); }
  }

  .pc-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: calc(14px + env(safe-area-inset-top, 0px)) 14px 12px;
    background: white;
    border-bottom: 1px solid #E2E8F0;
    flex-shrink: 0;
  }
  .pc-back {
    width: 36px; height: 36px;
    border: none;
    background: transparent;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #1F1F1F;
    font-family: inherit;
    flex-shrink: 0;
  }
  .pc-back:hover { background: #F1F5F9; }
  .pc-back svg { width: 22px; height: 22px; }
  .pc-avatar {
    width: 38px; height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, #34D399, #059669);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 14px;
    flex-shrink: 0;
  }
  .pc-avatar--club    { background: linear-gradient(135deg, #60A5FA, #2563EB); }
  .pc-avatar--contact { background: linear-gradient(135deg, #A78BFA, #7C3AED); }
  .pc-info { flex: 1; min-width: 0; }
  .pc-name {
    font-size: 15px;
    font-weight: 900;
    color: #1F1F1F;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pc-status {
    font-size: 11px;
    color: #059669;
    font-weight: 700;
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .pc-status-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #10B981;
    box-shadow: 0 0 0 2px rgba(16,185,129,0.18);
  }
  .pc-close {
    width: 36px; height: 36px;
    border: none;
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    color: #64748B;
    font-size: 18px;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .pc-close:hover { background: #F1F5F9; color: #1F1F1F; }

  .pc-messages {
    flex: 1;
    overflow-y: auto;
    padding: 14px 14px 8px;
    background: #FAFBFC;
    display: flex;
    flex-direction: column;
  }
  .pc-divider {
    text-align: center;
    margin: 4px 0 14px;
  }
  .pc-divider span {
    background: rgba(255,255,255,0.95);
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
    border: 1px solid #E2E8F0;
  }
  .pc-bubble {
    max-width: 78%;
    padding: 9px 12px 7px;
    border-radius: 14px;
    margin-bottom: 8px;
    font-size: 14px;
    line-height: 1.45;
    word-wrap: break-word;
  }
  .pc-bubble--received {
    background: #FFF3D6;
    color: #1F1F1F;
    border-top-left-radius: 4px;
    align-self: flex-start;
  }
  .pc-bubble--sent {
    background: #F7931E;
    color: white;
    border-top-right-radius: 4px;
    align-self: flex-end;
  }
  .pc-bubble-time {
    font-size: 10px;
    margin-top: 4px;
    opacity: 0.62;
    font-weight: 600;
  }

  .pc-input-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
    background: white;
    border-top: 1px solid #E2E8F0;
    flex-shrink: 0;
  }
  .pc-input {
    flex: 1;
    border: 1.5px solid #E2E8F0;
    border-radius: 999px;
    padding: 11px 16px;
    font-size: 14px;
    font-family: inherit;
    background: white;
    outline: none;
    transition: border-color 0.15s;
    color: #1F1F1F;
  }
  .pc-input:focus { border-color: #F7931E; }
  .pc-input::placeholder { color: #94A3B8; }
  .pc-send {
    width: 42px; height: 42px;
    border-radius: 50%;
    background: #F7931E;
    color: white;
    border: none;
    cursor: pointer;
    font-size: 16px;
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, transform 0.12s;
  }
  .pc-send:active { background: #E87F0A; transform: scale(0.94); }
  .pc-send:disabled { background: #CBD5E1; cursor: not-allowed; transform: none; }
  `;

  const styleEl = document.createElement('style');
  styleEl.id = 'passChatPopupStyle';
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  // ============================================================
  // HTML 주입
  // ============================================================
  const HTML = `
    <div class="pc-overlay" id="passChatOverlay" aria-hidden="true"></div>
    <aside class="pc-screen" id="passChatScreen" role="dialog" aria-modal="true" aria-labelledby="passChatName">
      <header class="pc-header">
        <button type="button" class="pc-back" id="passChatBack" aria-label="뒤로">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="pc-avatar" id="passChatAvatar">M</div>
        <div class="pc-info">
          <div class="pc-name" id="passChatName">상대 이름</div>
          <div class="pc-status">
            <span class="pc-status-dot" aria-hidden="true"></span>
            <span id="passChatStatus">CHON 인증된 모임원</span>
          </div>
        </div>
        <button type="button" class="pc-close" id="passChatClose" aria-label="닫기">✕</button>
      </header>
      <div class="pc-messages" id="passChatMessages"></div>
      <div class="pc-input-bar">
        <input type="text" class="pc-input" id="passChatInput" placeholder="메시지 입력" autocomplete="off"/>
        <button type="button" class="pc-send" id="passChatSend" aria-label="보내기">▶</button>
      </div>
    </aside>
  `;
  const mount = () => {
    document.body.insertAdjacentHTML('beforeend', HTML);
    wireUp();
  };
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  // ============================================================
  // 동작
  // ============================================================
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function fmtDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function statusFor(kind) {
    if (kind === 'family')  return 'CHON 인증된 가족';
    if (kind === 'club')    return 'CHON 인증된 모임원';
    if (kind === 'contact') return 'CHON 인증된 연락처';
    return 'CHON 인증됨';
  }

  function open(opts) {
    opts = opts || {};
    const name = opts.name || '?';
    const initial = (opts.initial || name).charAt(0);
    const kind = ['family', 'club', 'contact'].includes(opts.kind) ? opts.kind : 'family';
    const status = opts.status || statusFor(kind);

    const avatar = document.getElementById('passChatAvatar');
    avatar.textContent = initial;
    avatar.className = 'pc-avatar' + (kind === 'family' ? '' : ' pc-avatar--' + kind);
    document.getElementById('passChatName').textContent = name;
    document.getElementById('passChatStatus').textContent = status;

    const container = document.getElementById('passChatMessages');
    container.innerHTML = '';
    if (opts.body) {
      const ts = opts.ts || Date.now();
      container.insertAdjacentHTML('beforeend', `
        <div class="pc-divider"><span>${esc(fmtDate(ts))}</span></div>
        <div class="pc-bubble pc-bubble--received">
          <div>${esc(opts.body)}</div>
          <div class="pc-bubble-time">${esc(fmtTime(ts))}</div>
        </div>
      `);
    } else {
      const ts = Date.now();
      container.insertAdjacentHTML('beforeend', `
        <div class="pc-divider"><span>${esc(fmtDate(ts))}</span></div>
      `);
    }
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });

    document.getElementById('passChatOverlay').classList.add('visible');
    document.getElementById('passChatScreen').classList.add('visible');
    setTimeout(() => {
      const input = document.getElementById('passChatInput');
      if (input) input.focus();
    }, 280);
  }

  function close() {
    document.getElementById('passChatOverlay').classList.remove('visible');
    document.getElementById('passChatScreen').classList.remove('visible');
    const input = document.getElementById('passChatInput');
    if (input) input.value = '';
  }

  function send() {
    const input = document.getElementById('passChatInput');
    const text = (input.value || '').trim();
    if (!text) return;
    const container = document.getElementById('passChatMessages');
    const now = Date.now();
    container.insertAdjacentHTML('beforeend', `
      <div class="pc-bubble pc-bubble--sent">
        <div>${esc(text)}</div>
        <div class="pc-bubble-time">${esc(fmtTime(now))}</div>
      </div>
    `);
    input.value = '';
    requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
    input.focus();
  }

  function isOpen() {
    const screen = document.getElementById('passChatScreen');
    return screen && screen.classList.contains('visible');
  }

  function wireUp() {
    const back = document.getElementById('passChatBack');
    const closeBtn = document.getElementById('passChatClose');
    const overlay = document.getElementById('passChatOverlay');
    const input = document.getElementById('passChatInput');
    const sendBtn = document.getElementById('passChatSend');
    if (!back || !closeBtn || !overlay || !input || !sendBtn) return;

    back.addEventListener('click', close);
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')       { e.preventDefault(); send(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  // ============================================================
  // Public API
  // ============================================================
  window.PassChat = { open, close, isOpen };
})();
