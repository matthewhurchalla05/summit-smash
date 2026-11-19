const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const accounts = require('./accounts.js');
const { handleConnection, rooms } = require('./game.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };

// very small rate limiter for login/register
const attempts = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  attempts.set(ip, list);
  return list.length > 20;
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 10000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  if (url.pathname.startsWith('/api/')) {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (req.method === 'POST' && (url.pathname === '/api/register' || url.pathname === '/api/login')) {
      if (limited(ip)) return json(res, 429, { error: 'Too many tries, wait a minute' });
      const body = await readBody(req);
      const r = url.pathname === '/api/register' ? accounts.register(body.username, body.password) : accounts.login(body.username, body.password);
      return json(res, r.error ? 400 : 200, r);
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') { accounts.logout(token); return json(res, 200, { ok: true }); }
    if (req.method === 'GET' && url.pathname === '/api/me') {
      const u = accounts.byToken(token);
      return u ? json(res, 200, { user: accounts.publicUser(u) }) : json(res, 401, { error: 'Not logged in' });
    }
    if (req.method === 'POST' && url.pathname === '/api/look') {
      const u = accounts.byToken(token);
      if (!u) return json(res, 401, { error: 'Not logged in' });
      const body = await readBody(req);
      accounts.setLook(u, body.character, body.hat);
      return json(res, 200, { user: accounts.publicUser(u) });
    }
    if (req.method === 'GET' && url.pathname === '/api/leaderboard') return json(res, 200, { top: accounts.leaderboard(10) });
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, rooms: rooms.size });
    return json(res, 404, { error: 'Not found' });
  }

  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  file = path.normalize(path.join(PUBLIC, file));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) {
      // unknown paths (e.g. /room/ABCD) get the app
      return fs.readFile(path.join(PUBLIC, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end(d2);
      });
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  handleConnection(ws);
});
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 15000);

server.listen(PORT, () => console.log(`Summit Smash running on http://localhost:${PORT}`));
