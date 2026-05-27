/**
 * PASS — QR / 카메라 스캐너 (공통)
 *
 * 사용법:
 *   1) 페이지 <head> 에 한 줄: <script src="<상대경로>/lib/scanner.js"></script>
 *   2) 어디서든 호출:        openScanner()      또는 openScanner({ onScan: (text) => {...} })
 *
 * 동작:
 *   · 어두운 풀스크린 오버레이 + 카메라 라이브 프리뷰
 *   · 가운데 점선 뷰파인더 (코너 브라켓 가이드)
 *   · jsQR 라이브러리(CDN)를 lazy-load 해 QR 코드 자동 감지
 *   · 감지 시 onScan(text) 콜백 호출 + 모달 닫기
 *   · 라이브러리 로드 실패해도 카메라 미리보기는 동작 (수동 닫기)
 *
 * 권한:
 *   · getUserMedia 거부 시 안내 메시지 표시
 *   · HTTPS 또는 localhost 가 아니면 카메라 사용 불가
 */
(function (global) {
  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  let injected = false;
  let stream = null;
  let scanLoopId = null;

  // ============================================================
  // 모달 마크업 + 스타일 1회 주입
  // ============================================================
  function injectOnce() {
    if (injected) return;
    injected = true;

    const css = `
      .scanner-overlay {
        position: fixed; inset: 0;
        background: rgba(0, 0, 0, 0.92);
        z-index: 1000;
        display: none;
        flex-direction: column;
        align-items: center;
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
        color: white;
      }
      .scanner-overlay.visible { display: flex; }
      .scanner-topbar {
        width: 100%;
        max-width: 480px;
        padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .scanner-title {
        font-size: 17px;
        font-weight: 800;
      }
      .scanner-close {
        width: 40px; height: 40px;
        background: rgba(255,255,255,0.12);
        border: none;
        border-radius: 50%;
        color: white;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: inherit;
      }
      .scanner-close:active { background: rgba(255,255,255,0.22); }
      .scanner-stage {
        flex: 1;
        width: 100%;
        max-width: 480px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .scanner-video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .scanner-canvas { display: none; }
      .scanner-mask {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .scanner-mask::before {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.55);
        -webkit-mask-image: radial-gradient(circle at 50% 50%, transparent 130px, #000 132px);
                mask-image: radial-gradient(circle at 50% 50%, transparent 130px, #000 132px);
      }
      .scanner-viewfinder {
        position: relative;
        width: 240px; height: 240px;
        border-radius: 24px;
        z-index: 1;
      }
      .scanner-viewfinder::before,
      .scanner-viewfinder::after,
      .scanner-viewfinder .v-tr,
      .scanner-viewfinder .v-br {
        content: '';
        position: absolute;
        width: 32px; height: 32px;
        border: 3px solid #F7931E;
      }
      .scanner-viewfinder::before { top: 0;    left: 0;    border-right: 0; border-bottom: 0; border-radius: 14px 0 0 0; }
      .scanner-viewfinder::after  { bottom: 0; left: 0;    border-right: 0; border-top: 0;    border-radius: 0 0 0 14px; }
      .scanner-viewfinder .v-tr   { top: 0;    right: 0;   border-left: 0;  border-bottom: 0; border-radius: 0 14px 0 0; }
      .scanner-viewfinder .v-br   { bottom: 0; right: 0;   border-left: 0;  border-top: 0;    border-radius: 0 0 14px 0; }
      .scanner-scanline {
        position: absolute;
        left: 8%; right: 8%;
        top: 50%;
        height: 2px;
        background: linear-gradient(90deg, transparent, #F7931E, transparent);
        box-shadow: 0 0 14px #F7931E;
        animation: scanline 2.2s ease-in-out infinite;
      }
      @keyframes scanline {
        0%, 100% { transform: translateY(-110px); opacity: 0; }
        10%      { opacity: 1; }
        50%      { transform: translateY(110px); opacity: 1; }
        90%      { opacity: 1; }
      }
      .scanner-hint {
        position: absolute;
        bottom: 28%;
        left: 0; right: 0;
        text-align: center;
        font-size: 14px;
        font-weight: 600;
        color: white;
        opacity: 0.92;
        z-index: 1;
        padding: 0 20px;
        line-height: 1.5;
      }
      .scanner-hint.warn { color: #FFC300; }
      .scanner-actions {
        width: 100%;
        max-width: 480px;
        padding: 14px 16px calc(20px + env(safe-area-inset-bottom, 0px));
        display: flex;
        gap: 10px;
      }
      .scanner-btn {
        flex: 1;
        height: 50px;
        border-radius: 999px;
        border: 1.5px solid rgba(255,255,255,0.3);
        background: transparent;
        color: white;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
        font-family: inherit;
      }
      .scanner-btn:active { background: rgba(255,255,255,0.08); }
      .scanner-btn.primary {
        background: #F7931E;
        border-color: #F7931E;
        box-shadow: 0 6px 18px rgba(247, 147, 30, 0.4);
      }
      .scanner-result {
        position: absolute;
        left: 12px; right: 12px; bottom: 16%;
        padding: 12px 16px;
        background: rgba(0,0,0,0.7);
        border: 1px solid rgba(247,147,30,0.6);
        border-radius: 14px;
        color: white;
        font-size: 13px;
        word-break: break-all;
        display: none;
        z-index: 2;
      }
      .scanner-result.show { display: block; }
      .scanner-result-label {
        color: #F7931E;
        font-weight: 800;
        font-size: 11px;
        margin-bottom: 4px;
      }
    `;

    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const html = `
      <div class="scanner-overlay" id="scannerOverlay">
        <div class="scanner-topbar">
          <div class="scanner-title">QR 코드 스캔</div>
          <button type="button" class="scanner-close" id="scannerCloseBtn" aria-label="닫기">✕</button>
        </div>
        <div class="scanner-stage">
          <video class="scanner-video" id="scannerVideo" playsinline muted></video>
          <canvas class="scanner-canvas" id="scannerCanvas"></canvas>
          <div class="scanner-mask"></div>
          <div class="scanner-viewfinder">
            <span class="v-tr"></span><span class="v-br"></span>
            <div class="scanner-scanline"></div>
          </div>
          <div class="scanner-hint" id="scannerHint">QR 코드를 사각형 안에 맞춰주세요</div>
          <div class="scanner-result" id="scannerResult">
            <div class="scanner-result-label">스캔 결과</div>
            <div id="scannerResultText"></div>
          </div>
        </div>
        <div class="scanner-actions">
          <button type="button" class="scanner-btn" id="scannerCancelBtn">취소</button>
          <button type="button" class="scanner-btn primary" id="scannerManualBtn">수동으로 닫기</button>
        </div>
      </div>
    `;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);

    document.getElementById('scannerCloseBtn').addEventListener('click', closeScanner);
    document.getElementById('scannerCancelBtn').addEventListener('click', closeScanner);
    document.getElementById('scannerManualBtn').addEventListener('click', closeScanner);
  }

  // ============================================================
  // jsQR (CDN) 1회 lazy-load
  // ============================================================
  let jsqrLoading = null;
  function loadJsQR() {
    if (global.jsQR) return Promise.resolve(global.jsQR);
    if (jsqrLoading) return jsqrLoading;
    jsqrLoading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = JSQR_URL;
      s.async = true;
      s.onload = () => resolve(global.jsQR || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
    return jsqrLoading;
  }

  // ============================================================
  // 카메라 시작 / 정지
  // ============================================================
  async function startCamera() {
    const video = document.getElementById('scannerVideo');
    const hint = document.getElementById('scannerHint');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      hint.textContent = '⚠️ 이 브라우저는 카메라를 지원하지 않습니다';
      hint.classList.add('warn');
      return false;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      hint.textContent = 'QR 코드를 사각형 안에 맞춰주세요';
      hint.classList.remove('warn');
      return true;
    } catch (e) {
      hint.innerHTML = '⚠️ 카메라 권한이 필요합니다<br/>(HTTPS 또는 localhost 에서만 동작)';
      hint.classList.add('warn');
      return false;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    const v = document.getElementById('scannerVideo');
    if (v) v.srcObject = null;
  }

  // ============================================================
  // 스캔 루프 (jsQR)
  // ============================================================
  function startScanLoop() {
    const video = document.getElementById('scannerVideo');
    const canvas = document.getElementById('scannerCanvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function tick() {
      if (!global.jsQR || !video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        scanLoopId = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = global.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (code && code.data) {
        onCodeDetected(code.data);
        return; // 정지
      }
      scanLoopId = requestAnimationFrame(tick);
    }
    scanLoopId = requestAnimationFrame(tick);
  }

  function stopScanLoop() {
    if (scanLoopId) {
      cancelAnimationFrame(scanLoopId);
      scanLoopId = null;
    }
  }

  // ============================================================
  // 감지 시 처리
  // ============================================================
  let userOptions = {};
  function onCodeDetected(text) {
    stopScanLoop();
    // 결과 박스 표시
    const box = document.getElementById('scannerResult');
    document.getElementById('scannerResultText').textContent = text;
    box.classList.add('show');

    // 짧은 진동 (지원 시)
    if (navigator.vibrate) navigator.vibrate(80);

    // 사용자 콜백 또는 기본 처리
    setTimeout(() => {
      if (typeof userOptions.onScan === 'function') {
        try { userOptions.onScan(text); } catch (e) {}
      }
      closeScanner();
    }, 1200);
  }

  // ============================================================
  // 공개 API
  // ============================================================
  function openScanner(opts) {
    injectOnce();
    userOptions = opts || {};
    document.getElementById('scannerOverlay').classList.add('visible');
    document.getElementById('scannerResult').classList.remove('show');

    startCamera().then((ok) => {
      if (!ok) return;
      loadJsQR().then((jsqr) => {
        if (jsqr) startScanLoop();
        else {
          // jsQR 로드 실패 — 안내만 표시
          const hint = document.getElementById('scannerHint');
          hint.innerHTML = '카메라는 동작 중이지만 QR 디코더를 불러올 수 없어요<br/>(네트워크 확인 후 다시 시도)';
          hint.classList.add('warn');
        }
      });
    });
  }

  function closeScanner() {
    stopScanLoop();
    stopCamera();
    const overlay = document.getElementById('scannerOverlay');
    if (overlay) overlay.classList.remove('visible');
  }

  // ESC 로 닫기
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeScanner();
  });

  // export
  global.openScanner = openScanner;
  global.closeScanner = closeScanner;

})(typeof window !== 'undefined' ? window : globalThis);
