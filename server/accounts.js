// Account storage in a JSON file. Passwords hashed with scrypt; session tokens stored as SHA-256 hashes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CHARACTERS, HATS, levelFromXp } = require('../public/characters.js');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILE = path.join(DATA_DIR, 'accounts.json');

let db = { users: {} }; // key: lowercase username
let saveTimer = null;

function load() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!db.users) db.users = {};
  } catch (e) {
    console.error('Could not load accounts file:', e.message);
  }
}

function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, 1000);
}
function saveNow() {
  clearTimeout(saveTimer); saveTimer = null;
  try {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, FILE);
  } catch (e) { console.error('Could not save accounts:', e.message); }
}

const hashToken = t => crypto.createHash('sha256').update(t).digest('hex');

function hashPassword(pw, salt) {
  return crypto.scryptSync(pw, salt, 64).toString('hex');
}

function validUsername(u) { return typeof u === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(u); }

function newSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  user.tokens = (user.tokens || []).slice(-9); // keep last 10 sessions
  user.tokens.push(hashToken(token));
  saveSoon();
  return token;
}

function register(username, password) {
  if (!validUsername(username)) return { error: 'Username must be 3-16 letters, numbers or _' };
  if (typeof password !== 'string' || password.length < 4 || password.length > 100) return { error: 'Password must be at least 4 characters' };
  const key = username.toLowerCase();
  if (db.users[key]) return { error: 'That username is taken' };
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    username, salt, hash: hashPassword(password, salt), created: Date.now(),
    xp: 0, stats: { matches: 0, matchWins: 0, rounds: 0, roundWins: 0, kos: 0, falls: 0 },
    character: 'usa', hat: 'none', tokens: [],
  };
  db.users[key] = user;
  const token = newSession(user);
  saveNow();
  return { token, user: publicUser(user) };
}

function login(username, password) {
  const user = typeof username === 'string' && db.users[username.toLowerCase()];
  if (!user || typeof password !== 'string') return { error: 'Wrong username or password' };
  const h = hashPassword(password, user.salt);
  if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(user.hash, 'hex'))) return { error: 'Wrong username or password' };
  return { token: newSession(user), user: publicUser(user) };
}

function byToken(token) {
  if (typeof token !== 'string' || !token) return null;
  const h = hashToken(token);
  for (const u of Object.values(db.users)) if (u.tokens && u.tokens.includes(h)) return u;
  return null;
}

function logout(token) {
  const u = byToken(token);
  if (u) { u.tokens = u.tokens.filter(t => t !== hashToken(token)); saveSoon(); }
}

function setLook(user, character, hat) {
  if (character && CHARACTERS.some(c => c.id === character)) user.character = character;
  if (hat) {
    const h = HATS.find(x => x.id === hat);
    if (h && levelFromXp(user.xp).level >= h.level) user.hat = hat;
  }
  saveSoon();
}

function addXp(username, amount, statChanges) {
  const user = db.users[username.toLowerCase()];
  if (!user) return null;
  const before = levelFromXp(user.xp).level;
  user.xp += amount;
  for (const [k, v] of Object.entries(statChanges || {})) user.stats[k] = (user.stats[k] || 0) + v;
  saveSoon();
  const after = levelFromXp(user.xp).level;
  return { user: publicUser(user), levelUp: after > before ? after : 0 };
}

function publicUser(u) {
  return { username: u.username, xp: u.xp, ...levelFromXp(u.xp), stats: u.stats, character: u.character, hat: u.hat };
}

function leaderboard(n = 10) {
  return Object.values(db.users)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, n)
    .map(u => ({ username: u.username, xp: u.xp, level: levelFromXp(u.xp).level, character: u.character, hat: u.hat, wins: u.stats.matchWins }));
}

load();
process.on('SIGINT', () => { saveNow(); process.exit(0); });
process.on('SIGTERM', () => { saveNow(); process.exit(0); });

module.exports = { register, login, logout, byToken, setLook, addXp, publicUser, leaderboard, saveNow };
