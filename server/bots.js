// Bot brain: stay over solid ground, chase the nearest opponent, back up and ram, go heavy on impact.
const { shapePos, pointInShape } = require('./physics.js');

const BOT_NAMES = ['Diplomat', 'Envoy', 'Attaché', 'Consul', 'Minister', 'Delegate', 'Senator', 'Governor'];

function groundBelow(world, x, y) {
  const t = world.time;
  const limit = Math.min(760, world.lava ?? 760);
  for (let yy = y + 10; yy < limit; yy += 12) {
    for (const s of world.shapes) {
      if (pointInShape(s, shapePos(s, t), x, yy)) return s.kind === 'death' ? null : { y: yy, shape: s };
    }
  }
  return null;
}

function nearestSafeX(world, x, y) {
  let best = null, bd = Infinity;
  for (const s of world.shapes) {
    if (s.kind === 'death') continue;
    const p = shapePos(s, world.time);
    if (world.lava != null && p.y > world.lava - 10) continue;
    const half = s.type === 'circle' ? s.r * 0.6 : (s.w / 2) * Math.abs(Math.cos(s.angle || 0)) * 0.7;
    const tx = Math.max(p.x - half, Math.min(p.x + half, x));
    const d = Math.abs(tx - x) + Math.max(0, y - p.y) * 2;
    if (d < bd) { bd = d; best = tx; }
  }
  return best == null ? 500 : best;
}

function deathNear(world, x, y, dir) {
  const t = world.time;
  for (const s of world.shapes) {
    if (s.kind !== 'death') continue;
    const p = shapePos(s, t);
    for (let k = 1; k <= 4; k++) {
      if (pointInShape(s, p, x + dir * k * 18, y)) return true;
      if (pointInShape(s, p, x + dir * k * 18, y + 30)) return true;
    }
  }
  return false;
}

function think(bot, world, balls) {
  const b = bot.ball;
  if (!b || !b.alive) return;
  const brain = bot.brain || (bot.brain = { skill: 0.55 + Math.random() * 0.4, timer: 0, input: {}, retreat: 0, stall: 0, aggro: 0.7 + Math.random() * 0.6 });
  brain.timer -= 1;
  if (brain.timer > 0) { b.input = brain.input; return; }
  const dtTicks = Math.round(2 + (1 - brain.skill) * 8);
  brain.timer = dtTicks;

  const inp = { l: false, r: false, u: false, d: false, h: false };
  const safeNow = groundBelow(world, b.x, b.y);

  let foe = null, fd = Infinity;
  for (const o of balls) {
    if (o === b || !o.alive) continue;
    const d = Math.hypot(o.x - b.x, o.y - b.y);
    if (d < fd) { fd = d; foe = o; }
  }

  let targetX, desiredV;
  if (!safeNow) {
    // airborne over nothing: get back to a platform
    targetX = nearestSafeX(world, b.x, b.y);
    desiredV = Math.max(-500, Math.min(500, (targetX - b.x) * 4));
    if (b.vy > 0) inp.u = true;
  } else if (foe && brain.retreat > 0) {
    brain.retreat -= dtTicks;
    targetX = b.x - Math.sign(foe.x - b.x) * 160;
    desiredV = Math.sign(targetX - b.x) * 260;
  } else if (foe) {
    if (fd < b.r * 2.8 && Math.abs(b.vx) < 70) {
      brain.stall += dtTicks;
      if (brain.stall > 30 + Math.random() * 30) { brain.retreat = 20 + Math.random() * 25; brain.stall = 0; }
    } else brain.stall = 0;
    const dir = Math.sign(foe.x - b.x) || 1;
    targetX = foe.x + dir * 120;
    desiredV = dir * (fd < 260 ? 600 : 360) * brain.aggro;
    if (fd < b.r * 4.5 && Math.random() < brain.skill) inp.h = true;
    if (foe.y < b.y - 60 && Math.abs(foe.x - b.x) < 140) inp.u = true;
    if (foe.y > b.y + 25 && Math.abs(foe.x - b.x) < b.r * 2) inp.d = true; // stomp
  } else {
    targetX = nearestSafeX(world, b.x, b.y);
    desiredV = (targetX - b.x) * 3;
  }

  // edge safety: if we could not stop before running out of floor, brake
  const stopDist = (b.vx * Math.abs(b.vx)) / (900 * (0.6 + brain.skill * 0.6));
  const probeX = b.x + stopDist + Math.sign(b.vx) * b.r;
  if (safeNow && Math.abs(b.vx) > 40 && !groundBelow(world, probeX, b.y)) {
    desiredV = (nearestSafeX(world, b.x, b.y) - b.x) * 3;
  }

  if (b.vx < desiredV - 25) inp.r = true;
  else if (b.vx > desiredV + 25) inp.l = true;

  const dir = inp.r ? 1 : inp.l ? -1 : 0;
  if (dir && deathNear(world, b.x, b.y, dir)) { inp.r = dir < 0; inp.l = dir > 0; inp.u = true; }

  // climb away from rising lava
  if (world.lava != null && world.lava - b.y < 140) {
    let best = null;
    for (const s of world.shapes) {
      if (s.kind === 'death') continue;
      const p = shapePos(s, world.time);
      if (p.y < b.y - 30 && (!best || Math.abs(p.x - b.x) < Math.abs(best.x - b.x))) best = p;
    }
    if (best) { inp.u = true; inp.h = false; inp.r = best.x > b.x; inp.l = best.x < b.x; }
  }

  if (Math.random() > brain.skill + 0.15) { inp.l = Math.random() < 0.5; inp.r = !inp.l; }
  brain.input = inp;
  b.input = inp;
}

module.exports = { think, BOT_NAMES };
