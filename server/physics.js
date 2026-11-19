// Simple circle-vs-shape physics for Summit Smash.
const GRAVITY = 820;
const MOVE_ACCEL = 560;
const UP_ACCEL = 480;
const HEAVY_MASS = 3.2;
const HEAVY_CONTROL = 0.35;
const BALL_RADIUS = 20;
const AIR_DRAG = 0.25;
const MAX_SPEED = 1400;

const KIND = {
  normal: { e: 0.35, friction: 1.3 },
  bouncy: { e: 1.15, friction: 1.0, minBounce: 420 },
  ice:    { e: 0.25, friction: 0.12 },
  death:  { e: 0, friction: 0 },
};

function shapePos(s, t) {
  if (!s.move) return { x: s.x, y: s.y, vx: 0, vy: 0 };
  const w = (2 * Math.PI) / s.move.period;
  const k = Math.sin(w * t), dk = Math.cos(w * t) * w;
  return { x: s.x + s.move.dx * k, y: s.y + s.move.dy * k, vx: s.move.dx * dk, vy: s.move.dy * dk };
}

// Returns {nx, ny, depth} if circle at (x,y,r) overlaps shape, else null. Normal points out of shape.
function collide(s, p, x, y, r) {
  if (s.type === 'circle') {
    const dx = x - p.x, dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d >= s.r + r) return null;
    if (d < 1e-6) return { nx: 0, ny: -1, depth: s.r + r };
    return { nx: dx / d, ny: dy / d, depth: s.r + r - d };
  }
  const a = s.angle || 0, c = Math.cos(a), sn = Math.sin(a);
  const dx = x - p.x, dy = y - p.y;
  const lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
  const hw = s.w / 2, hh = s.h / 2;
  let nlx, nly, depth;
  if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
    // centre inside rect: push out along the shallowest axis
    const px = hw - Math.abs(lx), py = hh - Math.abs(ly);
    if (px < py) { nlx = Math.sign(lx) || 1; nly = 0; depth = px + r; }
    else { nlx = 0; nly = Math.sign(ly) || -1; depth = py + r; }
  } else {
    const cx = Math.max(-hw, Math.min(hw, lx)), cy = Math.max(-hh, Math.min(hh, ly));
    const ex = lx - cx, ey = ly - cy;
    const d = Math.hypot(ex, ey);
    if (d >= r) return null;
    nlx = ex / d; nly = ey / d; depth = r - d;
  }
  return { nx: nlx * c - nly * sn, ny: nlx * sn + nly * c, depth };
}

function pointInShape(s, p, x, y) {
  if (s.type === 'circle') return Math.hypot(x - p.x, y - p.y) <= s.r;
  const a = s.angle || 0, c = Math.cos(a), sn = Math.sin(a);
  const dx = x - p.x, dy = y - p.y;
  const lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
  return Math.abs(lx) <= s.w / 2 && Math.abs(ly) <= s.h / 2;
}

function isOut(b) {
  return b.y > 800 || b.x < -250 || b.x > 1250 || b.y < -1500;
}

// Advance world by dt. balls: array of {x,y,vx,vy,r,heavy,alive,input,lastHitBy,lastHitAt}
// Returns list of events [{type:'ko', id, by}]
function step(world, balls, dt, now) {
  const events = [];
  const t = world.time;
  const live = balls.filter(b => b.alive);
  for (const b of live) {
    const inp = b.input || {};
    const ctrl = inp.h ? HEAVY_CONTROL : 1;
    b.heavy = !!inp.h;
    b.mass = b.heavy ? HEAVY_MASS : 1;
    let ax = ((inp.r ? 1 : 0) - (inp.l ? 1 : 0)) * MOVE_ACCEL * ctrl;
    let ay = GRAVITY + (inp.d ? MOVE_ACCEL * ctrl : 0) - (inp.u ? UP_ACCEL * ctrl : 0);
    b.vx += ax * dt; b.vy += ay * dt;
    const drag = 1 - AIR_DRAG * dt;
    b.vx *= drag; b.vy *= drag;
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
    b.x += b.vx * dt; b.y += b.vy * dt;
  }

  // Ball vs shapes
  for (const b of live) {
    b.grounded = false;
    for (let i = 0; i < world.shapes.length; i++) {
      const s = world.shapes[i];
      const p = shapePos(s, t);
      const hit = collide(s, p, b.x, b.y, b.r);
      if (!hit) continue;
      if (s.kind === 'death') { b.alive = false; events.push(koEvent(b, now, 'zap')); break; }
      const k = KIND[s.kind] || KIND.normal;
      b.x += hit.nx * hit.depth; b.y += hit.ny * hit.depth;
      const rvx = b.vx - p.vx, rvy = b.vy - p.vy;
      const vn = rvx * hit.nx + rvy * hit.ny;
      if (vn < 0) {
        let newVn = -vn * k.e;
        if (k.minBounce && newVn < k.minBounce && -vn > 60) newVn = Math.max(newVn, k.minBounce);
        if (-vn < 40 && !k.minBounce) newVn = 0; // rest
        const tx = rvx - vn * hit.nx, ty = rvy - vn * hit.ny;
        const f = Math.max(0, 1 - k.friction * dt);
        b.vx = p.vx + tx * f + hit.nx * newVn;
        b.vy = p.vy + ty * f + hit.ny * newVn;
        if (hit.ny < -0.5 && s.kind !== 'bouncy') b.grounded = true;
      }
    }
  }

  // Ball vs ball
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], c = live[j];
      if (!a.alive || !c.alive) continue;
      const dx = c.x - a.x, dy = c.y - a.y;
      const d = Math.hypot(dx, dy), min = a.r + c.r;
      if (d >= min || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d;
      const ima = 1 / a.mass, imc = 1 / c.mass, ims = ima + imc;
      const pen = min - d;
      a.x -= nx * pen * (ima / ims); a.y -= ny * pen * (ima / ims);
      c.x += nx * pen * (imc / ims); c.y += ny * pen * (imc / ims);
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rv < 0) {
        const e = 0.9;
        const jImp = -(1 + e) * rv / ims;
        a.vx -= jImp * ima * nx; a.vy -= jImp * ima * ny;
        c.vx += jImp * imc * nx; c.vy += jImp * imc * ny;
        if (Math.abs(rv) > 80) {
          a.lastHitBy = c.id; a.lastHitAt = now;
          c.lastHitBy = a.id; c.lastHitAt = now;
          events.push({ type: 'bump', x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, power: Math.min(1, Math.abs(rv) / 900) });
        }
      }
    }
  }

  for (const b of live) {
    if (b.alive && isOut(b)) { b.alive = false; events.push(koEvent(b, now, 'fall')); }
    else if (b.alive && world.lava != null && b.y + b.r * 0.5 > world.lava) { b.alive = false; events.push(koEvent(b, now, 'lava')); }
  }
  return events;
}

function koEvent(b, now, how) {
  const by = b.lastHitBy && now - b.lastHitAt < 4000 ? b.lastHitBy : null;
  return { type: 'ko', id: b.id, by, how, x: b.x, y: b.y };
}

module.exports = { step, shapePos, pointInShape, BALL_RADIUS };
