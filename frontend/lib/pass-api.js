/* ============================================================
   PASS API Client — frontend/ HTML 공통 모듈
   백엔드: NestJS @ http://localhost:3000/api
   ------------------------------------------------------------
   localStorage 키:
     pass_device_trust  { email, pin?, deviceId, registeredAt }  ← 이 디바이스 신뢰
     pass_tokens        { accessToken, refreshToken, expiresAt }  ← 세션 토큰
     passUser           { email, name, isNew?, loginAt }          ← 현재 로그인 (file:// origin 호환 위해 localStorage 사용)
     selfIdCreated      '1'                                       ← Self ID 생성 완료 플래그
     passWelcomed       '1'                                       ← 환영 메시지 1회 표시 플래그
   ============================================================ */
(function (global) {
  const DEFAULT_BASE = (function () {
    // 같은 호스트 사용 (배포 시), 로컬은 :3000
    if (typeof location !== 'undefined') {
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.protocol === 'file:') {
        return 'http://localhost:3000/api';
      }
      return location.origin + '/api';
    }
    return 'http://localhost:3000/api';
  })();

  const BASE = global.PASS_API_BASE || DEFAULT_BASE;
  const DEVICE_KEY = 'pass_device_trust';
  const TOKEN_KEY = 'pass_tokens';

  // ============================================================
  // Device ID — localStorage 기반 안정 식별자
  // ============================================================
  function getDeviceId() {
    let id = localStorage.getItem('pass_device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      try { localStorage.setItem('pass_device_id', id); } catch (e) {}
    }
    return id;
  }

  // ============================================================
  // Tokens
  // ============================================================
  function getTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null'); } catch (e) { return null; }
  }
  function setTokens(t) {
    if (!t) { localStorage.removeItem(TOKEN_KEY); return; }
    const expiresAt = t.expiresIn ? Date.now() + (t.expiresIn * 1000) : null;
    localStorage.setItem(TOKEN_KEY, JSON.stringify({
      accessToken: t.accessToken,
      refreshToken: t.refreshToken,
      expiresAt
    }));
  }
  function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // ============================================================
  // Device Trust
  // ============================================================
  function getDeviceTrust() {
    try { return JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null'); } catch (e) { return null; }
  }
  function setDeviceTrust(data) {
    const existing = getDeviceTrust() || {};
    const next = { deviceId: getDeviceId(), ...existing, ...data, updatedAt: Date.now() };
    localStorage.setItem(DEVICE_KEY, JSON.stringify(next));
    return next;
  }
  function clearDeviceTrust() {
    localStorage.removeItem(DEVICE_KEY);
  }

  // ============================================================
  // Core request
  // ============================================================
  async function request(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (opts.auth !== false) {
      const t = getTokens();
      if (t?.accessToken) headers['Authorization'] = 'Bearer ' + t.accessToken;
    }
    const res = await fetch(BASE + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    // 401 → 자동 refresh 1회 시도
    if (res.status === 401 && opts.auth !== false && !opts._retried) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return request(path, { ...opts, _retried: true });
      }
    }

    let body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) {
      const err = new Error(body?.message || ('HTTP ' + res.status));
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  async function tryRefresh() {
    const t = getTokens();
    if (!t?.refreshToken) return false;
    try {
      const r = await fetch(BASE + '/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: t.refreshToken, deviceId: getDeviceId() }),
      });
      if (!r.ok) return false;
      const data = await r.json();
      setTokens(data);
      return true;
    } catch (e) { return false; }
  }

  // ============================================================
  // API 메서드들
  // ============================================================
  const PassAPI = {
    BASE,
    getDeviceId, getTokens, setTokens, clearTokens,
    getDeviceTrust, setDeviceTrust, clearDeviceTrust,
    request,

    // ---------- AUTH ----------
    auth: {
      requestOtp: (channel, target, purpose = 'register') =>
        request('/auth/otp/request', { method: 'POST', auth: false, body: { channel, target, purpose } }),

      verifyOtp: (channel, target, code, purpose = 'register') =>
        request('/auth/otp/verify', { method: 'POST', auth: false, body: { channel, target, code, purpose } }),

      signup: (email, phone, password, otp, name) =>
        request('/auth/signup', { method: 'POST', auth: false, body: { email, phone, password, otp, name } }),

      loginPassword: (email, password) =>
        request('/auth/login/password', { method: 'POST', auth: false, body: { email, password, deviceId: getDeviceId() } }),

      loginPin: (pin) =>
        request('/auth/login/pin', { method: 'POST', auth: false, body: { deviceId: getDeviceId(), pin } }),

      setupPin: (pin) =>
        request('/auth/pin/setup', { method: 'POST', body: { deviceId: getDeviceId(), pin } }),

      logout: (all = false) =>
        request('/auth/logout', { method: 'POST', body: { deviceId: getDeviceId(), all } }),

      me: () => request('/auth/me'),
    },

    // ---------- USERS ----------
    users: {
      me: () => request('/users/me'),
      updateMe: (body) => request('/users/me', { method: 'PATCH', body }),
      deleteMe: () => request('/users/me', { method: 'DELETE' }),
    },

    // ---------- CONTACTS ----------
    contacts: {
      list: () => request('/contacts'),
      sync: (contacts) => request('/contacts/sync', { method: 'POST', body: { contacts } }),
    },

    // ---------- RELATIONS ----------
    relations: {
      mine: (kind, status) => {
        const q = new URLSearchParams();
        if (kind) q.set('kind', kind);
        if (status) q.set('status', status);
        return request('/relations/me' + (q.toString() ? '?' + q : ''));
      },
      incoming: () => request('/relations/incoming'),
      friendsOfFriends: () => request('/relations/friends-of-friends'),
      familyTree: () => request('/relations/family-tree'),
      classRoster: () => request('/relations/class-roster'),
      requestRel: (body) => request('/relations', { method: 'POST', body }),
      respond: (id, action) =>
        request(`/relations/${id}/respond`, { method: 'PATCH', body: { action } }),
      revoke: (id) => request(`/relations/${id}/revoke`, { method: 'PATCH' }),
    },

    // ---------- POSTS ----------
    posts: {
      feed: (filter = 'all', cursor, limit = 20) => {
        const q = new URLSearchParams({ filter, limit: String(limit) });
        if (cursor) q.set('cursor', cursor);
        return request('/posts/feed?' + q);
      },
      create: (content, audience = 'friends', imageUrl) =>
        request('/posts', { method: 'POST', body: { content, audience, imageUrl } }),
      delete: (id) => request(`/posts/${id}`, { method: 'DELETE' }),
      toggleLike: (id) => request(`/posts/${id}/like`, { method: 'POST' }),
      comments: (id) => request(`/posts/${id}/comments`),
      addComment: (id, content) => request(`/posts/${id}/comments`, { method: 'POST', body: { content } }),
    },

    // ---------- CHAT ----------
    chat: {
      list: () => request('/chat/conversations'),
      open: (userId) => request('/chat/conversations/open', { method: 'POST', body: { userId } }),
      messages: (id, cursor, limit = 50) => {
        const q = new URLSearchParams({ limit: String(limit) });
        if (cursor) q.set('cursor', cursor);
        return request(`/chat/conversations/${id}/messages?` + q);
      },
      send: (id, text) => request(`/chat/conversations/${id}/messages`, { method: 'POST', body: { text } }),
      read: (id) => request(`/chat/conversations/${id}/read`, { method: 'POST' }),
    },

    // ---------- GRAPHS (가계도 / 모임 / 학급) ----------
    graphs: {
      // kind: 'family' | 'group' | 'class'  → 응답 { kind, data, updatedAt }
      get: (kind) => request('/graphs/' + kind),
      // data: 그래프 전체 상태(JSON 직렬화 가능) → 응답 { ok, kind, updatedAt }
      save: (kind, data) => request('/graphs/' + kind, { method: 'PUT', body: { data } }),
    },

    // ---------- 헬퍼 — 로그인 후 세션 저장 ----------
    saveSession(loginResp, opts = {}) {
      setTokens(loginResp);
      try {
        localStorage.setItem('passUser', JSON.stringify({
          email: loginResp.user.email,
          name: loginResp.user.name,
          isNew: !!opts.isNew,
          loginAt: Date.now(),
        }));
      } catch (e) {}
      // 디바이스 trust 갱신 (PIN 별도 등록 안 했어도 email은 기록)
      setDeviceTrust({ email: loginResp.user.email });
    },
    clearSession() {
      clearTokens();
      try {
        localStorage.removeItem('passUser');
        localStorage.removeItem('passWelcomed');
        localStorage.removeItem('selfIdCreated');
      } catch (e) {}
      // pass_device_trust(PIN), pass_tutorial_seen은 디바이스 단위라 유지
    },
    isLoggedIn() {
      return !!getTokens()?.accessToken;
    },

    // ============================================================
    // WebSocket (실시간 채팅)
    // socket.io-client는 CDN 또는 npm으로 별도 로드 필요:
    //   <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
    // ============================================================
    connectChat() {
      const t = getTokens();
      if (!t?.accessToken) throw new Error('로그인 필요');
      if (typeof io === 'undefined') {
        throw new Error('socket.io-client 미로드 — <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script> 추가');
      }
      // BASE는 /api 가 붙어있으므로 잘라냄
      const wsBase = BASE.replace(/\/api$/, '');
      const socket = io(wsBase + '/chat', {
        auth: { token: t.accessToken },
        transports: ['websocket'],
        autoConnect: true,
      });
      return socket;
    },
  };

  global.PassAPI = PassAPI;
})(typeof window !== 'undefined' ? window : globalThis);
