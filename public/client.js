(function () {
  const { CHARACTERS, HATS, levelFromXp } = window.Shared;
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ss_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('ss_' + k, JSON.stringify(v)); } catch {} },
  };
  const charById = id => CHARACTERS.find(c => c.id === id) || CHARACTERS[0];

  // ---------------- app state ----------------
  const S = {
    token: store.get('token', null),
    user: null,
    character: store.get('character', 'usa'),
    hat: store.get('hat', 'none'),
    guestName: store.get('guestName', ''),
    ws: null, myId: null, lobby: null, map: null, phase: 'lobby',
    snaps: [], alive: new Map(), muted: store.get('muted', false),
    particles: [], floaters: [], shake: 0, round: 0, countdownEnd: 0,
  };

  // ---------------- HOME ----------------
  function myLevel() { return S.user ? S.user.level : 1; }

  function renderCharGrid() {
    const g = $('#char-grid'); g.innerHTML = '';
    for (const ch of CHARACTERS) {
      const b = el('button', 'char' + (ch.id === S.character ? ' sel' : ''));
      const cv = document.createElement('canvas'); cv.width = cv.height = 152;
      Avatars.drawBall(cv.getContext('2d'), ch.id, null, 76, 76, 66);
      const fl = document.createElement('canvas'); fl.className = 'flag'; fl.width = 60; fl.height = 40;
      Avatars.drawFlag(fl.getContext('2d'), ch.id, 0, 0, 60, 40);
      b.append(cv, fl, el('div', 'nm', esc(ch.leader)), el('div', 'ct', esc(ch.country)));
      b.onclick = () => { S.character = ch.id; store.set('character', ch.id); saveLook(); renderCharGrid(); renderAccount(); };
      g.append(b);
    }
  }

  function renderHatGrid() {
    const g = $('#hat-grid'); g.innerHTML = '';
    const lvl = myLevel();
    $('#hat-note').textContent = S.user ? `(level up to unlock more)` : `(make an account to unlock hats)`;
    for (const h of HATS) {
      const locked = lvl < h.level;
      const b = el('button', 'hat' + (h.id === S.hat ? ' sel' : '') + (locked ? ' locked' : ''));
      b.dataset.lv = h.level; b.title = locked ? `${h.name} — unlocks at level ${h.level}` : h.name;
      const cv = document.createElement('canvas'); cv.width = cv.height = 112;
      const c = cv.getContext('2d');
      Avatars.drawBall(c, S.character, h.id, 56, 80, 28);
      b.append(cv, el('span', '', esc(h.name)));
      b.onclick = () => { if (locked) return; S.hat = h.id; store.set('hat', h.id); saveLook(); renderHatGrid(); };
      g.append(b);
    }
  }

  function saveLook() {
    if (S.user) api('look', { character: S.character, hat: S.hat }).then(r => { if (r.user) S.user = r.user; });
    if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify({ t: 'look', character: S.character, hat: S.hat, token: S.token }));
  }

  async function api(path, body) {
    const r = await fetch('/api/' + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.json().catch(() => ({ error: 'Server error' }));
  }

  function setUser(user) {
    S.user = user;
    if (user) {
      S.character = user.character || S.character;
      // keep chosen hat if allowed
      const h = HATS.find(x => x.id === user.hat);
      S.hat = h ? user.hat : 'none';
      store.set('character', S.character); store.set('hat', S.hat);
    } else if (HATS.find(x => x.id === S.hat)?.level > 1) { S.hat = 'none'; }
    renderCharGrid(); renderHatGrid(); renderAccount(); renderMiniXp();
    $('#guest-name-row').classList.toggle('hidden', !!user);
  }

  let acctTab = 'register';
  function renderAccount() {
    const c = $('#account-card');
    if (S.user) {
      const u = S.user, st = u.stats || {};
      c.innerHTML = `
        <div class="profile">
          <canvas width="128" height="128"></canvas>
          <div class="who">
            <div class="uname">${esc(u.username)}</div>
            <span class="lvl">Level ${u.level}</span> <span class="muted small">${u.xp} XP total</span>
            <div class="xpbar"><div style="width:${Math.round(100 * u.into / u.need)}%"></div></div>
            <div class="muted small">${u.into} / ${u.need} XP to level ${u.level + 1}</div>
          </div>
        </div>
        <div class="stats">
          <div><b>${st.matchWins || 0}</b><span>Match wins</span></div>
          <div><b>${st.roundWins || 0}</b><span>Round wins</span></div>
          <div><b>${st.kos || 0}</b><span>Knockouts</span></div>
          <div><b>${st.matches || 0}</b><span>Matches</span></div>
          <div><b>${st.rounds || 0}</b><span>Rounds</span></div>
          <div><b>${st.rounds ? Math.round(100 * (st.roundWins || 0) / st.rounds) : 0}%</b><span>Win rate</span></div>
        </div>
        <button class="btn link" id="btn-logout">Log out</button>`;
      Avatars.drawBall(c.querySelector('canvas').getContext('2d'), S.character, S.hat, 64, 70, 46);
      $('#btn-logout').onclick = async () => { await api('logout', {}); S.token = null; store.set('token', null); setUser(null); };
    } else {
      c.innerHTML = `
        <h2>Account</h2>
        <p class="muted small" style="margin-top:-6px">Save your XP, level up, unlock hats and get on the leaderboard.</p>
        <div class="tabs">
          <button class="btn small ${acctTab === 'register' ? 'on' : ''}" data-tab="register">Sign up</button>
          <button class="btn small ${acctTab === 'login' ? 'on' : ''}" data-tab="login">Log in</button>
        </div>
        <form class="acct-form">
          <input name="username" placeholder="Username" maxlength="16" autocomplete="username" required>
          <input name="password" type="password" placeholder="Password" autocomplete="${acctTab === 'login' ? 'current-password' : 'new-password'}" required>
          <button class="btn big primary" type="submit">${acctTab === 'login' ? 'Log in' : 'Create account'}</button>
          <p class="error" id="acct-error"></p>
        </form>`;
      c.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { acctTab = b.dataset.tab; renderAccount(); });
      c.querySelector('form').onsubmit = async e => {
        e.preventDefault();
        const f = e.target;
        const r = await api(acctTab, { username: f.username.value.trim(), password: f.password.value });
        if (r.error) { $('#acct-error').textContent = r.error; return; }
        S.token = r.token; store.set('token', r.token);
        // a new account starts with whatever leader the guest had picked
        if (acctTab === 'register') { r.user.character = S.character; }
        setUser(r.user);
        if (acctTab === 'register') saveLook();
        loadLeaderboard();
      };
    }
  }

  function renderMiniXp() {
    const m = $('#my-xp-mini');
    m.innerHTML = S.user ? `<span class="lvl">Lv ${S.user.level}</span> ${S.user.into}/${S.user.need} XP` : '<span class="muted">Guest (no XP)</span>';
  }

  async function loadLeaderboard() {
    const r = await api('leaderboard');
    const ol = $('#leaderboard'); ol.innerHTML = '';
    if (!r.top || !r.top.length) { ol.innerHTML = '<li class="muted">No players yet. Be the first!</li>'; return; }
    for (const u of r.top) {
      const li = el('li');
      const cv = document.createElement('canvas'); cv.width = cv.height = 56;
      Avatars.drawBall(cv.getContext('2d'), u.character, null, 28, 28, 24);
      li.append(cv, el('span', 'n', esc(u.username)), el('span', 'lvl', 'Lv ' + u.level));
      ol.append(li);
    }
  }

  // ---------------- NETWORK ----------------
  function connect(then) {
    if (S.ws && S.ws.readyState <= 1) { if (S.ws.readyState === 1) then(); else S.ws.addEventListener('open', then, { once: true }); return; }
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    S.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'hello', token: S.token, name: S.guestName || 'Guest', character: S.character }));
      if (S.user) ws.send(JSON.stringify({ t: 'look', character: S.character, hat: S.hat, token: S.token }));
      then();
    };
    ws.onmessage = e => onMsg(JSON.parse(e.data));
    ws.onclose = () => {
      if (S.ws !== ws) return;
      S.ws = null;
      if ($('#game').classList.contains('active')) {
        showHome();
        $('#home-error').textContent = 'Lost connection to the server.';
      }
    };
  }
  function send(m) { if (S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(m)); }

  function onMsg(m) {
    switch (m.t) {
      case 'welcome': S.myId = m.id; break;
      case 'error':
        if ($('#game').classList.contains('active') && S.lobby) $('#lobby-error').textContent = m.msg;
        else { $('#home-error').textContent = m.msg; showHome(); }
        break;
      case 'lobby': onLobby(m); break;
      case 'map': S.map = m.map; S.ballR = m.ballRadius || 20; S.cam = fitCamera(m.map); S.snaps = []; S.particles = []; break;
      case 'phase':
        S.phase = m.phase;
        if (m.phase === 'countdown') { S.countdownEnd = performance.now() + m.until; S.round = m.round; sfx('count'); }
        if (m.phase === 'playing') { banner('GO!', '', 700); sfx('go'); }
        if (m.phase === 'lobby') { S.map = null; S.snaps = []; banner(null); }
        updateLobbyVisibility();
        break;
      case 's': {
        const balls = new Map();
        for (const [id, x, y, f] of m.b) balls.set(id, { x, y, alive: !!(f & 1), heavy: !!(f & 2) });
        S.snaps.push({ at: performance.now(), wt: m.wt, balls, lv: m.lv });
        if (S.snaps.length > 30) S.snaps.shift();
        break;
      }
      case 'ko': onKo(m); break;
      case 'suddenDeath': banner('SUDDEN DEATH', 'The lava is rising! Get high!', 2500); sfx('count'); break;
      case 'bump':
        S.shake = Math.max(S.shake, m.p * 8);
        sfx('bump', m.p);
        burst(m.x, m.y, ['#fff', '#ffe066'], Math.round(4 + m.p * 10), 120 + m.p * 200, 0.35);
        break;
      case 'roundEnd': {
        const w = m.winner && playerById(m.winner);
        S.phase = 'roundEnd';
        if (S.lobby) for (const s of m.scores) { const p = playerById(s.id); if (p) p.score = s.score; }
        banner(w ? `${esc(w.name)} wins the round!` : 'Draw!', w ? esc(charById(w.character).leader) : 'Nobody survived', 3000);
        sfx(m.winner === S.myId ? 'win' : 'round');
        renderScoreboard();
        break;
      }
      case 'matchEnd':
        S.phase = 'matchEnd';
        setTimeout(() => { banner(`🏆 ${esc(m.name)} wins!`, 'Match over', 5500); sfx('fanfare'); confetti(); }, 50);
        break;
      case 'xp':
        S.user = m.user;
        renderMiniXp();
        toast(`+${m.gained} XP${m.botsOnly ? ' <span class="muted small">(half XP with only bots)</span>' : ''}`, 'xp');
        if (m.levelUp) {
          toast(`⭐ Level up! You're level ${m.levelUp}`, 'xp');
          const h = HATS.find(x => x.level === m.levelUp);
          if (h) toast(`🎩 Unlocked: ${h.name}`, 'xp');
          sfx('level');
        }
        break;
      case 'chat': addChat(m); break;
    }
  }

  function playerById(id) { return S.lobby && S.lobby.players.find(p => p.id === id); }

  function onLobby(m) {
    const first = !S.lobby;
    S.lobby = m;
    S.phase = m.phase;
    $('#room-code').textContent = m.code;
    document.querySelectorAll('.code-again').forEach(x => x.textContent = m.code);
    if (first) history.replaceState(null, '', '/?room=' + m.code);
    // lobby player cards
    const lp = $('#lobby-players'); lp.innerHTML = '';
    for (const p of m.players) {
      const d = el('div', 'lp');
      const cv = document.createElement('canvas'); cv.width = 112; cv.height = 144;
      Avatars.drawBall(cv.getContext('2d'), p.character, p.hat, 56, 92, 40);
      d.append(cv, el('div', 'n', esc(p.name) + (p.id === S.myId ? ' (you)' : '')),
        el('div', 'tag2', p.isBot ? '🤖 Bot' : p.guest ? 'Guest' : 'Level ' + p.level));
      if (p.id === m.hostId) d.append(el('span', 'host', '👑'));
      lp.append(d);
    }
    const isHost = m.hostId === S.myId;
    $('#host-controls').classList.toggle('hidden', !isHost);
    $('#wait-host').classList.toggle('hidden', isHost);
    $('#btn-stop').classList.toggle('hidden', !isHost || m.phase === 'lobby');
    const sm = $('#set-map');
    if (sm.options.length !== m.maps.length + 1) {
      sm.innerHTML = '<option value="random">🎲 Random rotation</option>' + m.maps.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    }
    sm.value = m.settings.map;
    $('#set-score').value = String(m.settings.winScore);
    const bots = m.players.filter(p => p.isBot).length;
    $('#btn-rmbot').disabled = !bots;
    $('#btn-addbot').disabled = m.players.length >= 8;
    $('#btn-start').textContent = m.players.length < 2 ? 'Start match (add a bot or invite a friend)' : 'Start match';
    $('#btn-start').disabled = m.players.length < 2;
    updateLobbyVisibility();
    renderScoreboard();
  }

  function updateLobbyVisibility() {
    $('#lobby').classList.toggle('hidden', S.phase !== 'lobby');
    const r = $('#round-label');
    r.textContent = S.phase === 'lobby' ? 'Lobby' : `Round ${S.round || (S.lobby && S.lobby.round) || 1} · first to ${S.lobby ? S.lobby.settings.winScore : 5}`;
    if (S.lobby) $('#btn-stop').classList.toggle('hidden', S.lobby.hostId !== S.myId || S.phase === 'lobby');
  }

  function renderScoreboard() {
    const sb = $('#scoreboard'); sb.innerHTML = '';
    if (!S.lobby) return;
    const target = S.lobby.settings.winScore;
    const last = S.snaps[S.snaps.length - 1];
    const players = [...S.lobby.players].sort((a, b) => b.score - a.score);
    for (const p of players) {
      const b = last && last.balls.get(p.id);
      const dead = S.phase !== 'lobby' && (!b || !b.alive);
      const row = el('div', 'sb-row' + (p.id === S.myId ? ' me' : '') + (dead ? ' dead' : ''));
      const cv = document.createElement('canvas'); cv.width = cv.height = 60;
      Avatars.drawBall(cv.getContext('2d'), p.character, null, 30, 30, 26);
      const pips = el('div', 'pips'); for (let i = 0; i < target; i++) pips.append(el('i', i < p.score ? 'on' : ''));
      const mid = el('div', 'n'); mid.innerHTML = esc(p.name); mid.append(pips);
      row.append(cv, mid, el('span', 's', p.score));
      sb.append(row);
    }
  }

  // ---------------- UI wiring ----------------
  function closeSocket() {
    const ws = S.ws; S.ws = null;
    if (ws) try { ws.close(); } catch {}
  }
  function showHome() {
    closeSocket();
    $('#game').classList.remove('active'); $('#home').classList.add('active');
    S.lobby = null; S.map = null;
    history.replaceState(null, '', '/');
    loadLeaderboard();
  }
  function showGame() {
    $('#home').classList.remove('active'); $('#game').classList.add('active');
    $('#chat-log').innerHTML = ''; $('#lobby-error').textContent = '';
    resize();
  }
  function readGuestName() {
    const n = $('#guest-name').value.trim();
    S.guestName = n; store.set('guestName', n);
    return S.user || n;
  }

  $('#btn-create').onclick = () => {
    $('#home-error').textContent = '';
    if (!readGuestName()) { $('#home-error').textContent = 'Type a name first (or log in).'; $('#guest-name').focus(); return; }
    unlockAudio();
    connect(() => { send({ t: 'create' }); showGame(); });
  };
  $('#btn-join').onclick = () => {
    $('#home-error').textContent = '';
    const code = $('#join-code').value.trim().toUpperCase();
    if (code.length !== 4) { $('#home-error').textContent = 'Room codes are 4 letters.'; return; }
    if (!readGuestName()) { $('#home-error').textContent = 'Type a name first (or log in).'; $('#guest-name').focus(); return; }
    unlockAudio();
    connect(() => { send({ t: 'join', code }); showGame(); });
  };
  $('#join-code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btn-join').click(); });
  $('#btn-leave').onclick = () => { send({ t: 'leave' }); showHome(); };
  function copyInvite() {
    const link = location.origin + '/?room=' + (S.lobby ? S.lobby.code : '');
    const done = () => toast('Invite link copied! Send it to your friends.');
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => prompt('Copy this link:', link));
    else prompt('Copy this link:', link);
  }
  $('#btn-copy').onclick = copyInvite;
  $('#btn-copy2').onclick = copyInvite;
  $('#btn-start').onclick = () => { $('#lobby-error').textContent = ''; send({ t: 'start' }); };
  $('#btn-stop').onclick = () => send({ t: 'stop' });
  $('#btn-addbot').onclick = () => send({ t: 'addBot' });
  $('#btn-rmbot').onclick = () => send({ t: 'removeBot' });
  $('#set-map').onchange = e => send({ t: 'settings', map: e.target.value });
  $('#set-score').onchange = e => send({ t: 'settings', winScore: +e.target.value });
  $('#btn-mute').onclick = () => { S.muted = !S.muted; store.set('muted', S.muted); $('#btn-mute').textContent = S.muted ? '🔇' : '🔊'; };
  $('#btn-mute').textContent = S.muted ? '🔇' : '🔊';

  // chat
  $('#chat-form').onsubmit = e => {
    e.preventDefault();
    const i = $('#chat-input');
    if (i.value.trim()) send({ t: 'chat', text: i.value });
    i.value = ''; i.blur();
  };
  function addChat(m) {
    const log = $('#chat-log');
    const d = el('div', m.name ? '' : 'sys', m.name ? `<b>${esc(m.name)}:</b> ${esc(m.text)}` : esc(m.text));
    log.append(d);
    while (log.children.length > 100) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
    if (m.name && window.matchMedia('(max-width: 900px)').matches) toast(`<b>${esc(m.name)}:</b> ${esc(m.text)}`);
  }

  function banner(html, sub, ms) {
    const b = $('#banner');
    clearTimeout(banner.t);
    if (!html) { b.classList.add('hidden'); return; }
    b.innerHTML = html + (sub ? `<small>${sub}</small>` : '');
    b.classList.remove('hidden');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    if (ms) banner.t = setTimeout(() => b.classList.add('hidden'), ms);
  }
  function toast(html, cls) {
    const t = el('div', 'toast ' + (cls || ''), html);
    $('#toasts').append(t);
    setTimeout(() => t.remove(), 4000);
  }

  // ---------------- INPUT ----------------
  const input = { l: false, r: false, u: false, d: false, h: false };
  const KEYS = {
    ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
    KeyX: 'h', Space: 'h', ShiftLeft: 'h', ShiftRight: 'h',
  };
  let lastSent = '';
  function pushInput(force) {
    const s = JSON.stringify(input);
    if (s !== lastSent || force) { lastSent = s; send({ t: 'input', ...input }); }
  }
  setInterval(() => { if ($('#game').classList.contains('active')) pushInput(true); }, 300);
  const typing = () => document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
  addEventListener('keydown', e => {
    if (!$('#game').classList.contains('active')) return;
    if (e.key === 'Enter' && !typing()) { $('#chat-input').focus(); e.preventDefault(); return; }
    if (e.key === 'Escape' && typing()) { document.activeElement.blur(); return; }
    if (typing()) return;
    const k = KEYS[e.code];
    if (k) { input[k] = true; pushInput(); e.preventDefault(); }
  });
  addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) { input[k] = false; pushInput(); } });
  addEventListener('blur', () => { for (const k in input) input[k] = false; pushInput(); });

  // touch buttons
  document.querySelectorAll('.tb').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); input[k] = true; b.classList.add('on'); pushInput(); unlockAudio(); };
    const off = e => { e.preventDefault(); input[k] = false; b.classList.remove('on'); pushInput(); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    b.addEventListener('contextmenu', e => e.preventDefault());
  });

  // ---------------- SOUND ----------------
  let actx = null;
  function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
  function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
    if (!actx || S.muted) return;
    const t0 = actx.currentTime + delay;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function sfx(name, p = 1) {
    switch (name) {
      case 'bump': tone(160 + p * 120, 0.12, 'triangle', 0.08 + p * 0.15, -80); break;
      case 'ko': tone(520, 0.45, 'sawtooth', 0.08, -440); break;
      case 'count': [0, 1, 2].forEach(i => tone(440, 0.12, 'square', 0.06, 0, i)); break;
      case 'go': tone(880, 0.25, 'square', 0.08); break;
      case 'round': tone(523, 0.15, 'triangle', 0.12); tone(659, 0.2, 'triangle', 0.12, 0, 0.12); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, 0, i * 0.1)); break;
      case 'fanfare': [523, 523, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, 0.22, 'square', 0.07, 0, [0, .12, .24, .36, .6, .78, .9][i])); break;
      case 'level': [659, 880, 1175].forEach((f, i) => tone(f, 0.2, 'sine', 0.15, 0, i * 0.09)); break;
    }
  }

  // ---------------- EFFECTS ----------------
  const FLAGCOL = {
    usa: ['#b22234', '#fff', '#3c3b6e'], uk: ['#012169', '#fff', '#c8102e'], france: ['#0055a4', '#fff', '#ef4135'],
    germany: ['#222', '#dd0000', '#ffce00'], israel: ['#0038b8', '#fff'], china: ['#de2910', '#ffde00'],
    russia: ['#fff', '#0039a6', '#d52b1e'], japan: ['#fff', '#bc002d'], poland: ['#fff', '#dc143c'],
    czechia: ['#fff', '#d7141a', '#11457e'], horse: ['#9a6234', '#3a2414', '#f5efe6'],
  };
  function burst(x, y, colors, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random());
      S.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, life, max: life, c: colors[i % colors.length], r: 2 + Math.random() * 4 });
    }
  }
  function confetti() {
    const cols = ['#ffcc33', '#ff5a5f', '#3ddc84', '#4fa3ff', '#fff'];
    const c = S.cam || { zoom: 1, x: 0, y: 0 };
    for (let i = 0; i < 140; i++) S.particles.push({ x: c.x + Math.random() * W / c.zoom, y: c.y - 20 - Math.random() * 200, vx: (Math.random() - .5) * 80, vy: 80 + Math.random() * 160, life: 4, max: 4, c: cols[i % 5], r: 3 + Math.random() * 3, g: 60, sq: true });
  }
  function onKo(m) {
    const p = playerById(m.id), k = m.by && playerById(m.by);
    const c = S.cam || { zoom: 1, x: 0, y: 0 };
    const x = Math.max(c.x + 20, Math.min(c.x + W / c.zoom - 20, m.x)), y = Math.max(c.y + 20, Math.min(c.y + H / c.zoom - 20, m.y));
    burst(x, y, FLAGCOL[p ? p.character : 'horse'] || ['#fff'], 36, 380, 0.9);
    S.shake = Math.max(S.shake, 10);
    S.floaters.push({ x, y: y - 20, text: 'KO!', life: 1.2 });
    sfx('ko');
    const how = { zap: 'got zapped', lava: 'melted in the lava', fall: 'fell off' }[m.how] || 'fell off';
    if (p) toast(k ? `💥 <b>${esc(k.name)}</b> knocked out <b>${esc(p.name)}</b>` : `💀 <b>${esc(p.name)}</b> ${how}`);
    renderScoreboard();
  }

  // ---------------- RENDER ----------------
  const cv = $('#canvas'), ctx = cv.getContext('2d');
  const W = 1000, H = 650;
  let scale = 1, dpr = 1;
  function resize() {
    const st = $('#stage');
    const w = st.clientWidth, h = st.clientHeight;
    if (!w || !h) return;
    scale = Math.min(w / W, h / H);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = Math.floor(W * scale) + 'px'; cv.style.height = Math.floor(H * scale) + 'px';
    cv.width = Math.floor(W * scale * dpr); cv.height = Math.floor(H * scale * dpr);
  }
  addEventListener('resize', resize);
  new ResizeObserver(resize).observe($('#stage'));

  function shapePos(s, t) {
    if (!s.move) return { x: s.x, y: s.y };
    const k = Math.sin((2 * Math.PI / s.move.period) * t);
    return { x: s.x + s.move.dx * k, y: s.y + s.move.dy * k };
  }

  // Zoom the view so the map's platforms fill the screen.
  function fitCamera(map) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const add = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    for (const s of map.shapes) {
      let hx, hy;
      if (s.type === 'circle') hx = hy = s.r;
      else { const c = Math.abs(Math.cos(s.angle || 0)), n = Math.abs(Math.sin(s.angle || 0)); hx = (s.w * c + s.h * n) / 2; hy = (s.w * n + s.h * c) / 2; }
      const mx = s.move ? Math.abs(s.move.dx) : 0, my = s.move ? Math.abs(s.move.dy) : 0;
      add(s.x - hx - mx, s.y - hy - my); add(s.x + hx + mx, s.y + hy + my);
    }
    for (const [x, y] of map.spawns) add(x, y);
    x0 -= 90; x1 += 90; y0 -= 120; y1 += 70;
    let w = x1 - x0, h = y1 - y0;
    if (w / h < W / H) w = h * W / H; else h = w * H / W;
    const zoom = Math.max(1, Math.min(1.45, W / w));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { zoom, x: cx - W / 2 / zoom, y: cy - H / 2 / zoom };
  }

  const INTERP_MS = 80;
  function interpState(now) {
    const snaps = S.snaps;
    if (!snaps.length) return null;
    const rt = now - INTERP_MS;
    let a = snaps[0], b = snaps[snaps.length - 1];
    for (let i = snaps.length - 1; i > 0; i--) {
      if (snaps[i - 1].at <= rt) { a = snaps[i - 1]; b = snaps[i]; break; }
    }
    const span = b.at - a.at;
    const f = span > 0 ? Math.max(0, Math.min(1, (rt - a.at) / span)) : 1;
    const balls = new Map();
    for (const [id, bb] of b.balls) {
      const aa = a.balls.get(id) || bb;
      balls.set(id, { x: aa.x + (bb.x - aa.x) * f, y: aa.y + (bb.y - aa.y) * f, alive: bb.alive && (f > 0.5 || aa.alive), heavy: f < 0.5 ? aa.heavy : bb.heavy });
    }
    return { wt: a.wt + (b.wt - a.wt) * f, balls, lv: b.lv != null ? (a.lv ?? b.lv) + (b.lv - (a.lv ?? b.lv)) * f : null };
  }

  const SHAPE_STYLE = {
    normal: { fill: '#dfe4f2', top: '#ffffff', edge: '#8c97b5' },
    bouncy: { fill: '#3ddc84', top: '#9dffc4', edge: '#1f8a50' },
    ice:    { fill: '#9fe3ff', top: '#e6f9ff', edge: '#4aa8d0' },
    death:  { fill: '#ff3b3b', top: '#ff9a7a', edge: '#a01818' },
  };

  function drawShape(s, p, t) {
    const st = SHAPE_STYLE[s.kind] || SHAPE_STYLE.normal;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (s.kind === 'death') { ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 14 + Math.sin(t * 6) * 6; }
    if (s.type === 'circle') {
      ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2);
      ctx.fillStyle = st.fill; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3; ctx.strokeStyle = st.edge; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, s.r - 6, Math.PI * 1.15, Math.PI * 1.6); ctx.strokeStyle = st.top; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
      if (s.kind === 'bouncy') { ctx.beginPath(); ctx.arc(0, 0, s.r * 0.55, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.stroke(); }
    } else {
      ctx.rotate(s.angle || 0);
      const w = s.w, h = s.h;
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(8, h / 2));
      ctx.fillStyle = st.fill; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5; ctx.strokeStyle = st.edge; ctx.stroke();
      ctx.fillStyle = st.top; ctx.fillRect(-w / 2 + 6, -h / 2 + 3, w - 12, 3);
      if (s.kind === 'bouncy') {
        ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(8, h / 2)); ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 4;
        for (let x = -w / 2 - h; x < w / 2 + h; x += 18) { ctx.beginPath(); ctx.moveTo(x, h / 2); ctx.lineTo(x + h, -h / 2); ctx.stroke(); }
        ctx.restore();
      }
      if (s.kind === 'death') {
        ctx.save(); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(8, h / 2)); ctx.clip();
        for (let i = 0; i < 6; i++) {
          const yy = ((t * 30 + i * 40) % (h + 40)) - h / 2 - 20;
          ctx.fillStyle = 'rgba(255,220,120,.35)'; ctx.beginPath(); ctx.arc(Math.sin(i * 3.1) * w * 0.3, -yy, 3, 0, 7); ctx.fill();
        }
        ctx.restore();
      }
      if (s.move) { ctx.fillStyle = 'rgba(0,0,0,.25)'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * (w / 2 - 10), 0, 3, 0, 7); ctx.fill(); } }
    }
    ctx.restore();
  }

  let bgCache = null, bgKey = '';
  function drawBackground(map) {
    const key = map ? map.id : 'none';
    if (bgKey !== key || !bgCache) {
      bgKey = key;
      bgCache = document.createElement('canvas'); bgCache.width = W; bgCache.height = H;
      const c = bgCache.getContext('2d');
      const base = map ? map.bg : '#20304a';
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, base); g.addColorStop(1, '#0a0f1c');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // stars / dots
      let seed = key.length * 99;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 70; i++) { c.fillStyle = `rgba(255,255,255,${0.04 + rnd() * 0.12})`; c.beginPath(); c.arc(rnd() * W, rnd() * H * 0.8, rnd() * 2 + 0.5, 0, 7); c.fill(); }
      // faint flags of all nations along the bottom
      c.globalAlpha = 0.07;
      CHARACTERS.forEach((ch, i) => Avatars.drawFlag(c, ch.id, 20 + i * 90, 600, 60, 40));
      c.globalAlpha = 1;
    }
    ctx.drawImage(bgCache, 0, 0);
  }

  let lastFrame = performance.now(), sbTimer = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
    if (!$('#game').classList.contains('active')) return;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);

    let sx = 0, sy = 0;
    if (S.shake > 0.1) { sx = (Math.random() - .5) * S.shake; sy = (Math.random() - .5) * S.shake; S.shake *= Math.pow(0.02, dt); } else S.shake = 0;
    ctx.save(); ctx.translate(sx, sy);

    drawBackground(S.map);
    const cam = S.cam || { zoom: 1, x: 0, y: 0 };
    ctx.save();
    ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.x, -cam.y);
    const st = interpState(now);
    if (S.map) {
      const t = st ? st.wt : 0;
      for (const s of S.map.shapes) drawShape(s, shapePos(s, t), now / 1000);
    }

    // balls
    if (st && S.lobby) {
      const order = [...st.balls.entries()].sort((a, b) => (a[0] === S.myId) - (b[0] === S.myId));
      for (const [id, b] of order) {
        if (!b.alive) continue;
        const p = playerById(id); if (!p) continue;
        const me = id === S.myId;
        const R = S.ballR || 20;
        const x = Math.max(cam.x - 30, Math.min(cam.x + W / cam.zoom + 30, b.x)), y = b.y;
        Avatars.drawBall(ctx, p.character, p.hat, x, y, R, { heavy: b.heavy, ring: me ? '#ffcc33' : undefined });
        // name tag
        ctx.font = '800 12px Nunito, sans-serif'; ctx.textAlign = 'center';
        const hasHat = p.hat && p.hat !== 'none';
        const ty = y - (hasHat ? R * 2.6 : R + 10);
        const label = p.name;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.roundRect(x - tw / 2 - 16, ty - 11, tw + 22, 16, 6); ctx.fill();
        Avatars.drawFlag(ctx, p.character, x - tw / 2 - 13, ty - 8, 12, 9);
        ctx.fillStyle = me ? '#ffcc33' : '#fff'; ctx.fillText(label, x + 5, ty + 1);
        if (me && S.phase === 'countdown') {
          ctx.fillStyle = '#ffcc33'; ctx.beginPath(); ctx.moveTo(x - 7, ty - 26); ctx.lineTo(x + 7, ty - 26); ctx.lineTo(x, ty - 16); ctx.fill();
        }
        // off-screen indicator
        if (b.y < cam.y - 10) { const yy = cam.y + 6; ctx.fillStyle = me ? '#ffcc33' : '#fff'; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x - 7, yy + 12); ctx.lineTo(x + 7, yy + 12); ctx.fill(); }
      }
    }

    // rising lava
    if (st && st.lv != null) {
      const top = st.lv, x0 = cam.x - 50, x1 = cam.x + W / cam.zoom + 50, bottom = cam.y + H / cam.zoom + 50;
      const tt = now / 1000;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x0, bottom);
      for (let x = x0; x <= x1; x += 20) ctx.lineTo(x, top + Math.sin(x * 0.03 + tt * 3) * 5);
      ctx.lineTo(x1, bottom); ctx.closePath();
      const g = ctx.createLinearGradient(0, top, 0, top + 200);
      g.addColorStop(0, '#ffb13b'); g.addColorStop(0.15, '#ff5a1f'); g.addColorStop(1, '#8a1010');
      ctx.fillStyle = g; ctx.shadowColor = '#ff6a00'; ctx.shadowBlur = 30; ctx.fill();
      ctx.restore();
    }

    // particles
    for (const p of S.particles) {
      p.life -= dt; p.vy += (p.g ?? 600) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      if (p.sq) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 6); ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    S.particles = S.particles.filter(p => p.life > 0);
    for (const f of S.floaters) {
      f.life -= dt; f.y -= 40 * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.font = '28px "Lilita One", sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 5; ctx.strokeStyle = '#0b1120'; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = '#ffcc33'; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    S.floaters = S.floaters.filter(f => f.life > 0);

    ctx.restore(); // camera
    ctx.restore(); // shake

    // countdown
    if (S.phase === 'countdown') {
      const left = Math.ceil((S.countdownEnd - now) / 1000);
      if (left > 0) {
        ctx.font = '120px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 10; ctx.strokeStyle = '#0b1120'; ctx.strokeText(left, W / 2, H / 2 - 40);
        ctx.fillStyle = '#fff'; ctx.fillText(left, W / 2, H / 2 - 40);
        ctx.font = '26px "Lilita One", sans-serif';
        const mapName = S.map ? S.map.name : '';
        ctx.lineWidth = 6; ctx.strokeText(`Round ${S.round} · ${mapName}`, W / 2, H / 2 + 40);
        ctx.fillStyle = '#ffcc33'; ctx.fillText(`Round ${S.round} · ${mapName}`, W / 2, H / 2 + 40);
        ctx.textBaseline = 'alphabetic';
      }
    }
    // spectating hint
    if (S.phase !== 'lobby' && st && !st.balls.has(S.myId)) {
      ctx.font = '18px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fillText('Spectating: you will join next round', W / 2, H - 20);
    } else if (S.phase === 'playing' && st && st.balls.get(S.myId) && !st.balls.get(S.myId).alive) {
      ctx.font = '18px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fillText('Knocked out! Watch the others finish the round…', W / 2, H - 20);
    }

    sbTimer += dt;
    if (sbTimer > 0.5) { sbTimer = 0; if (S.phase !== 'lobby') renderScoreboard(); }
  }
  requestAnimationFrame(frame);

  // ---------------- boot ----------------
  $('#guest-name').value = S.guestName;
  const params = new URLSearchParams(location.search);
  const invite = (params.get('room') || '').toUpperCase().slice(0, 4);
  if (invite) {
    $('#join-code').value = invite;
    $('#home-error').innerHTML = `<span style="color:var(--good)">You've been invited to room <b>${esc(invite)}</b>. Pick your leader, then press Join!</span>`;
  }
  renderCharGrid(); renderHatGrid(); renderAccount(); renderMiniXp(); loadLeaderboard();
  if (S.token) api('me').then(r => { if (r.user) setUser(r.user); else { S.token = null; store.set('token', null); } });
})();
