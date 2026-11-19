const { step, BALL_RADIUS } = require('./physics.js');
const { MAPS } = require('./maps.js');
const { think, BOT_NAMES } = require('./bots.js');
const accounts = require('./accounts.js');
const { CHARACTERS, HATS } = require('../public/characters.js');

const TICK_HZ = 60;
const SUBSTEPS = 3;
const SEND_EVERY = 2; // 30 state updates / sec
const MAX_PLAYERS = 8;
const ROUND_TIME_LIMIT = 90; // seconds before a round is a draw
const SUDDEN_DEATH_AT = +process.env.SUDDEN_DEATH_AT || 40;  // seconds into a round when lava starts rising
const LAVA_SPEED = 22;       // units per second

const XP = { round: 10, roundWin: 25, ko: 8, matchWin: 100 };

const rooms = new Map();

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}

let nextId = 1;

class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map();
    this.hostId = null;
    this.settings = { map: 'random', winScore: 5 };
    this.phase = 'lobby';
    this.phaseUntil = 0;
    this.world = null;
    this.map = null;
    this.round = 0;
    this.tickCount = 0;
    this.lastMapId = null;
    this.interval = setInterval(() => this.tick(), 1000 / TICK_HZ);
  }

  destroy() { clearInterval(this.interval); rooms.delete(this.code); }

  humans() { return [...this.players.values()].filter(p => !p.isBot); }

  addPlayer(p) {
    if (this.players.size >= MAX_PLAYERS) {
      // kick a bot to make room for a human
      const bot = [...this.players.values()].find(x => x.isBot);
      if (!bot || p.isBot) return false;
      this.players.delete(bot.id);
    }
    p.score = 0; p.ball = null; p.roundKos = 0;
    this.players.set(p.id, p);
    if (!this.hostId && !p.isBot) this.hostId = p.id;
    this.sysChat(`${p.name} joined`);
    this.sendLobby();
    if (this.map) this.sendTo(p, { t: 'map', map: this.map, ballRadius: BALL_RADIUS, phase: this.phase });
    return true;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    if (p.ball) p.ball.alive = false;
    this.sysChat(`${p.name} left`);
    if (this.hostId === id) {
      const h = this.humans()[0];
      this.hostId = h ? h.id : null;
    }
    if (this.humans().length === 0) { this.destroy(); return; }
    if (this.phase !== 'lobby' && this.players.size < 2) this.toLobby();
    this.sendLobby();
  }

  addBot() {
    if (this.players.size >= MAX_PLAYERS) return;
    const used = new Set([...this.players.values()].map(p => p.name));
    const base = BOT_NAMES.find(n => !used.has(n + ' Bot')) || 'Bot';
    const taken = new Set([...this.players.values()].map(p => p.character));
    const free = CHARACTERS.filter(c => !taken.has(c.id));
    const pool = free.length ? free : CHARACTERS;
    const ch = pool[Math.floor(Math.random() * pool.length)];
    const hat = HATS[Math.floor(Math.random() * 4)];
    this.addPlayer({ id: 'b' + nextId++, name: base + ' Bot', isBot: true, character: ch.id, hat: hat.id, level: 0 });
  }

  removeBot() {
    const bots = [...this.players.values()].filter(p => p.isBot);
    if (bots.length) this.removePlayer(bots[bots.length - 1].id);
  }

  startMatch() {
    if (this.players.size < 2) return 'Need at least 2 players (add a bot!)';
    for (const p of this.players.values()) { p.score = 0; }
    this.round = 0;
    this.startRound();
    return null;
  }

  pickMap() {
    if (this.settings.map !== 'random') return MAPS.find(m => m.id === this.settings.map) || MAPS[0];
    const pool = MAPS.filter(m => m.id !== this.lastMapId);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  startRound() {
    this.round++;
    const map = this.pickMap();
    this.lastMapId = map.id;
    this.map = map;
    this.world = { shapes: map.shapes, time: 0 };
    const spawns = [...map.spawns].sort(() => Math.random() - 0.5);
    let i = 0;
    for (const p of this.players.values()) {
      const [x, y] = spawns[i++ % spawns.length];
      p.ball = { id: p.id, x, y, vx: 0, vy: 0, r: BALL_RADIUS, mass: 1, heavy: false, alive: true, input: {}, lastHitBy: null, lastHitAt: 0 };
      p.roundKos = 0;
      p.inRound = true;
    }
    this.phase = 'countdown';
    this.phaseUntil = Date.now() + 3000;
    this.roundStart = 0;
    this.broadcast({ t: 'map', map, ballRadius: BALL_RADIUS, phase: this.phase, round: this.round });
    this.sendLobby();
    this.broadcast({ t: 'phase', phase: 'countdown', until: 3000, round: this.round });
  }

  endRound(winner) {
    this.phase = 'roundEnd';
    this.phaseUntil = Date.now() + 3500;
    if (winner) winner.score++;
    const humansInRound = [...this.players.values()].filter(p => p.inRound && !p.isBot).length;
    const xpMult = humansInRound >= 2 ? 1 : 0.5; // half XP when playing only with bots
    const matchWinner = [...this.players.values()].find(p => p.score >= this.settings.winScore) || null;

    for (const p of this.players.values()) {
      if (!p.inRound || p.isBot || !p.account) continue;
      let xp = XP.round + p.roundKos * XP.ko;
      const stats = { rounds: 1, kos: p.roundKos, falls: p.ball && !p.ball.alive ? 1 : 0 };
      if (p === winner) { xp += XP.roundWin; stats.roundWins = 1; }
      if (matchWinner) {
        stats.matches = 1;
        if (p === matchWinner) { xp += XP.matchWin; stats.matchWins = 1; }
      }
      xp = Math.round(xp * xpMult);
      const res = accounts.addXp(p.account, xp, stats);
      if (res) {
        p.level = res.user.level;
        this.sendTo(p, { t: 'xp', gained: xp, user: res.user, levelUp: res.levelUp, botsOnly: xpMult < 1 });
      }
    }

    this.broadcast({ t: 'roundEnd', winner: winner ? winner.id : null, scores: this.scores() });
    if (matchWinner) {
      this.phase = 'matchEnd';
      this.phaseUntil = Date.now() + 6000;
      this.broadcast({ t: 'matchEnd', winner: matchWinner.id, name: matchWinner.name, scores: this.scores() });
      this.sysChat(`🏆 ${matchWinner.name} wins the match!`);
    }
    this.sendLobby();
  }

  toLobby() {
    this.phase = 'lobby';
    for (const p of this.players.values()) { p.ball = null; p.inRound = false; }
    this.broadcast({ t: 'phase', phase: 'lobby' });
    this.sendLobby();
  }

  scores() {
    return [...this.players.values()].map(p => ({ id: p.id, score: p.score }));
  }

  tick() {
    const now = Date.now();
    if (this.phase === 'countdown' && now >= this.phaseUntil) {
      this.phase = 'playing';
      this.roundStart = now;
      this.broadcast({ t: 'phase', phase: 'playing' });
    } else if (this.phase === 'roundEnd' && now >= this.phaseUntil) {
      this.startRound();
    } else if (this.phase === 'matchEnd' && now >= this.phaseUntil) {
      this.toLobby();
    }
    if (!this.world || this.phase === 'lobby') return;

    const balls = [];
    for (const p of this.players.values()) if (p.ball) balls.push(p.ball);

    if (this.phase === 'playing' || this.phase === 'roundEnd' || this.phase === 'matchEnd') {
      for (const p of this.players.values()) if (p.isBot && p.ball) think(p, this.world, balls);
      if (this.phase === 'playing' && this.world.time > SUDDEN_DEATH_AT) {
        if (this.world.lava == null) { this.world.lava = 720; this.broadcast({ t: 'suddenDeath' }); }
        this.world.lava -= LAVA_SPEED / TICK_HZ;
      }
      const dt = 1 / TICK_HZ / SUBSTEPS;
      for (let s = 0; s < SUBSTEPS; s++) {
        this.world.time += dt;
        const events = step(this.world, balls, dt, now);
        for (const ev of events) this.handleEvent(ev);
      }
      if (this.phase === 'playing') {
        const alive = [...this.players.values()].filter(p => p.ball && p.ball.alive);
        if (alive.length <= 1) this.endRound(alive[0] || null);
        else if (now - this.roundStart > ROUND_TIME_LIMIT * 1000) { this.sysChat('Time up — draw!'); this.endRound(null); }
      }
    }

    this.tickCount++;
    if (this.tickCount % SEND_EVERY === 0) {
      const b = balls.map(x => [x.id, Math.round(x.x * 10) / 10, Math.round(x.y * 10) / 10, (x.alive ? 1 : 0) | (x.heavy ? 2 : 0)]);
      const msg = { t: 's', wt: Math.round(this.world.time * 1000) / 1000, b };
      if (this.world.lava != null) msg.lv = Math.round(this.world.lava);
      this.broadcast(msg);
    }
  }

  handleEvent(ev) {
    if (ev.type === 'ko') {
      const victim = this.players.get(ev.id);
      const killer = ev.by && this.players.get(ev.by);
      if (killer && killer !== victim && this.phase === 'playing') killer.roundKos++;
      this.broadcast({ t: 'ko', id: ev.id, by: killer ? killer.id : null, how: ev.how, x: ev.x, y: ev.y });
    } else if (ev.type === 'bump') {
      this.broadcast({ t: 'bump', x: Math.round(ev.x), y: Math.round(ev.y), p: Math.round(ev.power * 100) / 100 });
    }
  }

  lobbyState() {
    return {
      t: 'lobby', code: this.code, hostId: this.hostId, phase: this.phase, settings: this.settings, round: this.round,
      maps: MAPS.map(m => ({ id: m.id, name: m.name })),
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, character: p.character, hat: p.hat, level: p.level, isBot: !!p.isBot, score: p.score, guest: !p.isBot && !p.account,
      })),
    };
  }

  sendLobby() { this.broadcast(this.lobbyState()); }

  sysChat(text) { this.broadcast({ t: 'chat', name: null, text }); }

  sendTo(p, msg) {
    if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
  }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s);
  }
}

// ---- connection handling ----

function cleanName(n) {
  if (typeof n !== 'string') return 'Guest';
  n = n.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16);
  return n || 'Guest';
}

function handleConnection(ws) {
  const player = { id: 'p' + nextId++, ws, name: 'Guest', character: 'usa', hat: 'none', level: 1, account: null, room: null, chatTimes: [] };
  const send = m => ws.readyState === 1 && ws.send(JSON.stringify(m));

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = player.room;

    switch (m.t) {
      case 'hello': {
        const user = accounts.byToken(m.token);
        if (user) {
          player.account = user.username; player.name = user.username;
          player.character = user.character; player.level = accounts.publicUser(user).level;
          player.hat = user.hat;
        } else {
          player.account = null; player.name = cleanName(m.name);
          player.level = 1; player.hat = 'none';
          if (CHARACTERS.some(c => c.id === m.character)) player.character = m.character;
        }
        send({ t: 'welcome', id: player.id, name: player.name, account: player.account });
        break;
      }
      case 'look': {
        if (CHARACTERS.some(c => c.id === m.character)) player.character = m.character;
        if (player.account) {
          const user = accounts.byToken(m.token);
          if (user && user.username === player.account) {
            accounts.setLook(user, m.character, m.hat);
            player.hat = user.hat; player.character = user.character;
          }
        }
        if (room) room.sendLobby();
        break;
      }
      case 'create': {
        if (room) room.removePlayer(player.id);
        const r = new Room(makeCode());
        rooms.set(r.code, r);
        player.room = r;
        r.addPlayer(player);
        break;
      }
      case 'join': {
        const code = String(m.code || '').toUpperCase().trim();
        const r = rooms.get(code);
        if (!r) { send({ t: 'error', msg: `No room with code ${code}` }); break; }
        if (r.humans().length >= MAX_PLAYERS) { send({ t: 'error', msg: 'That room is full' }); break; }
        if (room && room !== r) room.removePlayer(player.id);
        if (room === r) break;
        player.room = r;
        r.addPlayer(player);
        break;
      }
      case 'leave': {
        if (room) room.removePlayer(player.id);
        player.room = null;
        break;
      }
      case 'input': {
        if (room && player.ball) player.ball.input = { l: !!m.l, r: !!m.r, u: !!m.u, d: !!m.d, h: !!m.h };
        break;
      }
      case 'start': {
        if (!room || room.hostId !== player.id || room.phase !== 'lobby') break;
        const err = room.startMatch();
        if (err) send({ t: 'error', msg: err });
        break;
      }
      case 'stop': {
        if (room && room.hostId === player.id && room.phase !== 'lobby') { room.sysChat('Host ended the match'); room.toLobby(); }
        break;
      }
      case 'settings': {
        if (!room || room.hostId !== player.id) break;
        if (m.map === 'random' || MAPS.some(x => x.id === m.map)) room.settings.map = m.map;
        if ([3, 5, 7, 10].includes(m.winScore)) room.settings.winScore = m.winScore;
        room.sendLobby();
        break;
      }
      case 'addBot': if (room && room.hostId === player.id) room.addBot(); break;
      case 'removeBot': if (room && room.hostId === player.id) room.removeBot(); break;
      case 'chat': {
        if (!room || typeof m.text !== 'string') break;
        const now = Date.now();
        player.chatTimes = player.chatTimes.filter(x => now - x < 5000);
        if (player.chatTimes.length >= 5) break;
        player.chatTimes.push(now);
        const text = m.text.slice(0, 140).trim();
        if (text) room.broadcast({ t: 'chat', name: player.name, id: player.id, text });
        break;
      }
    }
  });

  ws.on('close', () => { if (player.room) player.room.removePlayer(player.id); });
}

module.exports = { handleConnection, rooms };
