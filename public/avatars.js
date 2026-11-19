// Cartoon caricatures drawn with canvas. All drawing is done in a unit where the ball radius R = 50.
(function () {
  const R = 50;

  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function path(ctx, pts, fill, stroke, lw, close = true) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p.length === 4) ctx.quadraticCurveTo(p[0], p[1], p[2], p[3]);
      else if (p.length === 6) ctx.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
      else ctx.lineTo(p[0], p[1]);
    }
    if (close) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, color, lw) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
  }

  // --- face parts ---
  function eyes(ctx, o = {}) {
    const y = o.y ?? -2, dx = o.dx ?? 15, w = o.w ?? 6.5, h = o.h ?? 6.5;
    for (const s of [-1, 1]) {
      ellipse(ctx, s * dx, y, w, h, '#fff', '#2b2b2b', 1.4);
      ellipse(ctx, s * dx + (o.look || 0), y + 0.8, w * 0.52, h * 0.55, o.iris || '#3a2a1e');
      ellipse(ctx, s * dx + (o.look || 0), y + 0.8, w * 0.24, h * 0.26, '#111');
      ellipse(ctx, s * dx + (o.look || 0) + 1.2, y - 0.6, 1.1, 1.1, '#fff');
      if (o.lid) path(ctx, [[s * dx - w - 1, y - h * 0.15], [s * dx, y - h - 3, s * dx + w + 1, y - h * 0.15], [s * dx + w + 1, y - h - 2], [s * dx - w - 1, y - h - 2]], o.skin);
    }
  }
  function brows(ctx, o = {}) {
    const y = o.y ?? -13, dx = o.dx ?? 15, c = o.color || '#3b2a1e', lw = o.lw ?? 3.2, tilt = o.tilt ?? 0, len = o.len ?? 8;
    for (const s of [-1, 1]) line(ctx, s * (dx - len), y + tilt * s * -1 + tilt, s * (dx + len), y - tilt * s * -1 + (o.arch ? -2 : 0), c, lw);
  }
  function nose(ctx, o = {}) {
    const y = o.y ?? 8, w = o.w ?? 5, c = o.color || 'rgba(120,60,40,0.55)';
    path(ctx, [[0, y - 10], [w, y + 2, 0, y + 3], [-w * 0.6, y + 3]], null, c, 2, false);
  }
  function mouth(ctx, kind, o = {}) {
    const y = o.y ?? 22, w = o.w ?? 12;
    ctx.save();
    if (kind === 'smile') path(ctx, [[-w, y - 2], [0, y + 8, w, y - 2]], null, '#6b2a20', 2.6, false);
    else if (kind === 'grin') {
      path(ctx, [[-w, y - 3], [0, y + 12, w, y - 3], [0, y - 1, -w, y - 3]], '#7a2020', '#5a1a14', 1.5);
      path(ctx, [[-w + 2, y - 2.5], [0, y - 0.5, w - 2, y - 2.5], [w - 3, y + 1.5], [0, y + 3, -w + 3, y + 1.5]], '#fff');
    } else if (kind === 'flat') line(ctx, -w, y, w, y, '#6b2a20', 2.6);
    else if (kind === 'frown') path(ctx, [[-w, y + 3], [0, y - 4, w, y + 3]], null, '#6b2a20', 2.6, false);
    else if (kind === 'purse') { ellipse(ctx, 0, y, w * 0.55, 4.5, '#c0605a', '#7a2a24', 1.5); ellipse(ctx, 0, y, 2.2, 1.8, '#7a2a24'); }
    else if (kind === 'smirk') path(ctx, [[-w, y + 1], [0, y + 4, w, y - 4]], null, '#6b2a20', 2.6, false);
    ctx.restore();
  }
  function cheeks(ctx, c = 'rgba(255,110,110,0.22)', y = 12) { ellipse(ctx, -27, y, 7, 4.5, c); ellipse(ctx, 27, y, 7, 4.5, c); }
  function glasses(ctx, o = {}) {
    const y = o.y ?? -2, dx = o.dx ?? 15, w = o.w ?? 11, h = o.h ?? 8.5, c = o.color || '#111', lw = o.lw ?? 3;
    ctx.save();
    ctx.strokeStyle = c; ctx.lineWidth = lw;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (o.round) ctx.ellipse(s * dx, y, w, h, 0, 0, Math.PI * 2);
      else ctx.roundRect(s * dx - w, y - h, w * 2, h * 2, 3);
      ctx.stroke();
      if (o.tint) { ctx.fillStyle = 'rgba(200,230,255,0.15)'; ctx.fill(); }
    }
    line(ctx, -dx + w, y - 1, dx - w, y - 1, c, lw * 0.8);
    ctx.restore();
  }
  function bodyCollar(ctx, suit, shirt, tie) {
    path(ctx, [[-50, 50], [-40, 36], [-14, 33], [0, 46], [14, 33], [40, 36], [50, 50]], suit);
    path(ctx, [[-14, 33], [0, 46], [14, 33], [8, 32], [0, 38], [-8, 32]], shirt);
    if (tie) path(ctx, [[-3.5, 37], [3.5, 37], [5, 50], [-5, 50]], tie);
  }

  // --- characters ---
  const DRAW = {
    usa(ctx) {
      skin(ctx, '#f0a764');
      bodyCollar(ctx, '#1d2847', '#fff', '#d0202a');
      cheeks(ctx, 'rgba(255,120,80,0.25)');
      eyes(ctx, { y: 0, w: 6, h: 4.5, iris: '#4f6f8f', lid: true, skin: '#f0a764' });
      // pale skin around eyes
      brows(ctx, { y: -10, color: '#e9c46a', lw: 3.4 });
      nose(ctx, { y: 10 });
      mouth(ctx, 'purse', { y: 23, w: 13 });
      // the famous swoop
      path(ctx, [[-46, -12], [-50, -42, -10, -50], [20, -54, 45, -40], [54, -30, 48, -8], [40, -24, 18, -22], [0, -18, -18, -24], [-32, -28, -40, -10]], '#f6d36b', '#c99a2e', 1.6);
      path(ctx, [[-30, -36], [0, -48, 36, -34]], null, '#e2b648', 2, false);
      path(ctx, [[-18, -28], [10, -38, 40, -26]], null, '#e2b648', 2, false);
    },
    uk(ctx) {
      skin(ctx, '#f2d1b6');
      bodyCollar(ctx, '#2b2f3a', '#e9eef7', '#8a1e2e');
      eyes(ctx, { y: 0, iris: '#4a6a4a' });
      glasses(ctx, { y: 0, dx: 16, w: 12, h: 9, color: '#1a1a1a', lw: 3.4 });
      brows(ctx, { y: -14, color: '#555', lw: 3 });
      nose(ctx);
      mouth(ctx, 'flat', { y: 24, w: 10 });
      cheeks(ctx);
      // thick grey hair with a side part
      path(ctx, [[-46, -8], [-52, -48, -8, -52], [30, -54, 47, -28], [50, -18, 46, -8], [40, -26, 30, -30], [8, -36, -14, -32], [-34, -30, -40, -6]], '#a8a8ad', '#7c7c82', 1.5);
      line(ctx, -14, -46, -12, -33, '#7c7c82', 1.6);
    },
    france(ctx) {
      skin(ctx, '#f4d4ba');
      bodyCollar(ctx, '#1a2440', '#fff', '#1a2440');
      eyes(ctx, { y: 0, iris: '#3f7ad0', w: 7, h: 6.5 });
      brows(ctx, { y: -12, color: '#3a2a20', lw: 3.4, arch: true });
      nose(ctx);
      mouth(ctx, 'smirk', { y: 23 });
      cheeks(ctx, 'rgba(255,120,120,0.15)');
      // short dark hair with a little quiff
      path(ctx, [[-45, -14], [-48, -46, -12, -50], [20, -56, 44, -36], [48, -26, 46, -14], [38, -28, 22, -32], [0, -36, -14, -30], [-34, -28, -40, -12]], '#4a3427', '#2d1f17', 1.5);
      path(ctx, [[-12, -48], [6, -60, 26, -48], [10, -46, -12, -48]], '#4a3427');
    },
    germany(ctx) {
      skin(ctx, '#f0ceb2');
      bodyCollar(ctx, '#2e3442', '#f2f2f2', '#3b5c8a');
      eyes(ctx, { y: 6, iris: '#5a7a9a', w: 6, h: 5.5 });
      glasses(ctx, { y: 6, dx: 15, w: 11, h: 7.5, color: 'rgba(120,120,130,0.8)', lw: 1.6, tint: true });
      brows(ctx, { y: -6, color: '#9a8a7a', lw: 2.6 });
      nose(ctx, { y: 14 });
      mouth(ctx, 'smile', { y: 28, w: 10 });
      // shiny high forehead + grey sides
      ellipse(ctx, -12, -32, 10, 5, 'rgba(255,255,255,0.35)');
      path(ctx, [[-48, -2], [-50, -24, -38, -32], [-34, -20, -40, 0]], '#c9c9c9', '#9a9a9a', 1.2);
      path(ctx, [[48, -2], [50, -24, 38, -32], [34, -20, 40, 0]], '#c9c9c9', '#9a9a9a', 1.2);
      path(ctx, [[-20, -44], [0, -50, 22, -44]], null, 'rgba(180,180,180,0.8)', 2, false);
    },
    israel(ctx) {
      skin(ctx, '#eec7a3');
      bodyCollar(ctx, '#20283a', '#fff', '#2a4c8c');
      eyes(ctx, { y: 2, iris: '#5a4a3a', w: 6, h: 5 });
      brows(ctx, { y: -9, color: '#555', lw: 4.4, tilt: 2 });
      nose(ctx, { y: 12, w: 7 });
      mouth(ctx, 'flat', { y: 26, w: 11 });
      ellipse(ctx, -16, 14, 8, 2, 'rgba(120,60,40,0.12)'); ellipse(ctx, 16, 14, 8, 2, 'rgba(120,60,40,0.12)');
      // white-grey swept hair
      path(ctx, [[-46, -10], [-50, -46, -6, -50], [34, -52, 47, -24], [48, -14, 45, -8], [36, -26, 16, -30], [-10, -32, -24, -26], [-38, -24, -42, -8]], '#e3e3e6', '#a9a9ae', 1.5);
      path(ctx, [[-30, -40], [0, -46, 34, -34]], null, '#c4c4c8', 1.6, false);
    },
    china(ctx) {
      skin(ctx, '#f1d2a9');
      bodyCollar(ctx, '#1c1c24', '#fff', '#a3202a');
      eyes(ctx, { y: 2, iris: '#3a2a1e', w: 6, h: 4 });
      brows(ctx, { y: -9, color: '#1a1a1a', lw: 3.6 });
      nose(ctx, { y: 11, w: 6 });
      mouth(ctx, 'smile', { y: 25, w: 12 });
      cheeks(ctx, 'rgba(255,130,110,0.2)', 14);
      // slicked-back black hair
      path(ctx, [[-46, -8], [-50, -48, 0, -52], [48, -50, 46, -8], [40, -26, 22, -30], [0, -32, -22, -30], [-40, -26, -46, -8]], '#16161a', '#000', 1.2);
      path(ctx, [[-30, -40], [0, -48, 30, -40]], null, '#3a3a44', 2, false);
      path(ctx, [[-24, -34], [0, -40, 24, -34]], null, '#3a3a44', 1.6, false);
    },
    russia(ctx) {
      skin(ctx, '#f2d6c4');
      bodyCollar(ctx, '#23262e', '#fff', '#2f3f6a');
      eyes(ctx, { y: 2, iris: '#7a9ab0', w: 5.5, h: 4.2, lid: true, skin: '#f2d6c4' });
      brows(ctx, { y: -8, color: '#a8906a', lw: 2.2 });
      nose(ctx, { y: 12 });
      mouth(ctx, 'flat', { y: 26, w: 8 });
      ellipse(ctx, -24, 18, 5, 3, 'rgba(120,60,40,0.08)'); ellipse(ctx, 24, 18, 5, 3, 'rgba(120,60,40,0.08)');
      // thin receding hair
      path(ctx, [[-44, -14], [-46, -34, -30, -40], [-16, -36, -22, -30], [-34, -30, -40, -12]], '#c2a87e');
      path(ctx, [[44, -14], [46, -34, 30, -40], [16, -36, 22, -30], [34, -30, 40, -12]], '#c2a87e');
      for (let i = -3; i <= 3; i++) line(ctx, i * 5, -44, i * 6, -36, 'rgba(180,150,110,0.55)', 1.4);
    },
    japan(ctx) {
      // hair behind the face
      ctx.fillStyle = '#3a2a20'; ctx.fillRect(-60, -60, 120, 120);
      ellipse(ctx, 0, 6, 38, 44, '#f5d8bd');
      eyes(ctx, { y: 2, dx: 14, iris: '#3a2418', w: 6.5, h: 6 });
      brows(ctx, { y: -9, dx: 14, color: '#3a2a20', lw: 2.4, len: 7, arch: true });
      nose(ctx, { y: 13, w: 4 });
      mouth(ctx, 'smile', { y: 27, w: 10 });
      cheeks(ctx, 'rgba(255,120,130,0.25)', 16);
      // bob with side-swept fringe
      path(ctx, [[-40, 10], [-46, -40, -6, -46], [30, -48, 42, -20], [44, 0, 40, 10], [36, -14, 24, -22], [-2, -30, -26, -12], [-34, -4, -40, 10]], '#3a2a20');
      ellipse(ctx, -39, 20, 3, 3, '#fffaf0', '#ccc', 1); ellipse(ctx, 39, 20, 3, 3, '#fffaf0', '#ccc', 1);
      path(ctx, [[-50, 50], [-30, 40], [0, 46], [30, 40], [50, 50]], '#2e4a7a');
    },
    poland(ctx) {
      skin(ctx, '#f0cfb6');
      bodyCollar(ctx, '#2a3040', '#fff', '#5a6a8a');
      eyes(ctx, { y: 1, iris: '#4a6a8a', w: 6, h: 5 });
      brows(ctx, { y: -10, color: '#6a6a6a', lw: 3.4, arch: true });
      nose(ctx, { y: 11 });
      mouth(ctx, 'grin', { y: 24, w: 14 });
      cheeks(ctx);
      // full grey-white hair, side part
      path(ctx, [[-46, -6], [-52, -50, -4, -52], [40, -54, 48, -20], [48, -10, 46, -4], [40, -22, 28, -28], [4, -36, -20, -28], [-38, -26, -42, -4]], '#dadadc', '#a2a2a6', 1.5);
      line(ctx, 14, -48, 12, -32, '#a2a2a6', 1.6);
    },
    czechia(ctx) {
      skin(ctx, '#f1c8a6');
      bodyCollar(ctx, '#2a2e3a', '#fff', '#2b5ca8');
      eyes(ctx, { y: 2, iris: '#5a4030', w: 5.5, h: 4.5 });
      brows(ctx, { y: -8, color: '#6a5a4a', lw: 4.2, len: 9 });
      nose(ctx, { y: 12, w: 7 });
      mouth(ctx, 'grin', { y: 26, w: 15 });
      cheeks(ctx, 'rgba(255,100,90,0.28)', 15);
      ellipse(ctx, -10, -34, 12, 6, 'rgba(255,255,255,0.35)');
      // short grey sides
      path(ctx, [[-48, 2], [-52, -24, -40, -30], [-36, -16, -42, 4]], '#9c9c9c');
      path(ctx, [[48, 2], [52, -24, 40, -30], [36, -16, 42, 4]], '#9c9c9c');
    },
    horse(ctx) {
      ctx.fillStyle = '#9a6234'; ctx.fillRect(-60, -60, 120, 120);
      // white blaze
      path(ctx, [[-6, -46], [6, -46], [10, 10], [-10, 10]], '#f5efe6');
      // mane
      path(ctx, [[-30, -50], [-14, -40, -4, -56], [6, -40, 16, -54], [24, -40, 34, -48], [30, -30, 20, -32], [0, -30, -20, -34], [-28, -40, -30, -50]], '#3a2414');
      // ears
      path(ctx, [[-36, -30], [-46, -56], [-24, -42]], '#8a5428', '#5a3418', 1.5);
      path(ctx, [[36, -30], [46, -56], [24, -42]], '#8a5428', '#5a3418', 1.5);
      // eyes on the sides
      for (const s of [-1, 1]) {
        ellipse(ctx, s * 26, -10, 8, 9, '#fff', '#2a1a0a', 1.5);
        ellipse(ctx, s * 24, -8, 5, 6, '#2a1a0a');
        ellipse(ctx, s * 22.5, -10.5, 1.6, 1.6, '#fff');
        line(ctx, s * 18, -22, s * 34, -18, '#2a1a0a', 2.5);
      }
      // snout
      ellipse(ctx, 0, 28, 30, 20, '#c9946a', '#7a4a24', 1.5);
      ellipse(ctx, -12, 22, 5, 3.5, '#3a2414'); ellipse(ctx, 12, 22, 5, 3.5, '#3a2414');
      // big goofy teeth
      path(ctx, [[-14, 34], [0, 46, 14, 34], [0, 38, -14, 34]], '#5a1a14');
      ctx.fillStyle = '#fffbea'; ctx.strokeStyle = '#bbb'; ctx.lineWidth = 1;
      for (let i = -2; i < 2; i++) { ctx.beginPath(); ctx.roundRect(i * 6, 35, 6, 9, 1.5); ctx.fill(); ctx.stroke(); }
    },
  };

  function skin(ctx, c) {
    ctx.fillStyle = c; ctx.fillRect(-60, -60, 120, 120);
    // soft shading
    const g = ctx.createRadialGradient(-15, -20, 5, 0, 0, 60);
    g.addColorStop(0, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g; ctx.fillRect(-60, -60, 120, 120);
  }

  // --- flags (drawn into rect x,y,w,h) ---
  const FLAG = {
    usa(c, w, h) {
      for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#fff' : '#b22234'; c.fillRect(0, i * h / 13, w, h / 13 + 0.5); }
      c.fillStyle = '#3c3b6e'; c.fillRect(0, 0, w * 0.4, h * 7 / 13);
      c.fillStyle = '#fff';
      for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(w * 0.04 + k * w * 0.08, h * 0.07 + r * h * 0.13, Math.max(0.6, w * 0.012), 0, 7); c.fill(); }
    },
    uk(c, w, h) {
      c.fillStyle = '#012169'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#fff'; c.lineWidth = h * 0.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
      c.strokeStyle = '#c8102e'; c.lineWidth = h * 0.07; c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.moveTo(w, 0); c.lineTo(0, h); c.stroke();
      c.fillStyle = '#fff'; c.fillRect(w * 0.4, 0, w * 0.2, h); c.fillRect(0, h * 0.35, w, h * 0.3);
      c.fillStyle = '#c8102e'; c.fillRect(w * 0.44, 0, w * 0.12, h); c.fillRect(0, h * 0.4, w, h * 0.2);
    },
    france(c, w, h) { ['#0055a4', '#fff', '#ef4135'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * w / 3, 0, w / 3 + 0.5, h); }); },
    germany(c, w, h) { ['#000', '#dd0000', '#ffce00'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * h / 3, w, h / 3 + 0.5); }); },
    israel(c, w, h) {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#0038b8'; c.fillRect(0, h * 0.1, w, h * 0.15); c.fillRect(0, h * 0.75, w, h * 0.15);
      c.strokeStyle = '#0038b8'; c.lineWidth = Math.max(1, h * 0.04);
      const cx = w / 2, cy = h / 2, r = h * 0.2;
      for (const rot of [0, Math.PI]) {
        c.beginPath();
        for (let i = 0; i < 3; i++) { const a = rot - Math.PI / 2 + i * 2 * Math.PI / 3; c[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
        c.closePath(); c.stroke();
      }
    },
    china(c, w, h) {
      c.fillStyle = '#de2910'; c.fillRect(0, 0, w, h);
      star(c, w * 0.17, h * 0.27, h * 0.16, '#ffde00');
      [[0.33, 0.1], [0.4, 0.2], [0.4, 0.35], [0.33, 0.45]].forEach(([x, y]) => star(c, w * x, h * y, h * 0.055, '#ffde00'));
    },
    russia(c, w, h) { ['#fff', '#0039a6', '#d52b1e'].forEach((col, i) => { c.fillStyle = col; c.fillRect(0, i * h / 3, w, h / 3 + 0.5); }); },
    japan(c, w, h) { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#bc002d'; c.beginPath(); c.arc(w / 2, h / 2, h * 0.3, 0, 7); c.fill(); },
    poland(c, w, h) { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#dc143c'; c.fillRect(0, h / 2, w, h / 2); },
    czechia(c, w, h) {
      c.fillStyle = '#fff'; c.fillRect(0, 0, w, h / 2); c.fillStyle = '#d7141a'; c.fillRect(0, h / 2, w, h / 2);
      c.fillStyle = '#11457e'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h / 2); c.lineTo(0, h); c.fill();
    },
    horse(c, w, h) {
      c.fillStyle = '#5a8a3a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#d9d9d9'; c.lineWidth = Math.max(1.5, h * 0.12); c.lineCap = 'round';
      c.beginPath(); c.arc(w / 2, h * 0.55, h * 0.28, Math.PI * 0.85, Math.PI * 2.15); c.stroke();
    },
  };
  function star(c, x, y, r, col) {
    c.fillStyle = col; c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r; c[i ? 'lineTo' : 'moveTo'](x + rr * Math.cos(a), y + rr * Math.sin(a)); }
    c.closePath(); c.fill();
  }

  function drawFlag(ctx, id, x, y, w, h) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    (FLAG[id] || FLAG.horse)(ctx, w, h);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); ctx.restore();
  }

  // --- hats, drawn above a ball of radius 50 centred at 0,0 ---
  const HAT = {
    none() {},
    party(c) {
      path(c, [[-22, -40], [0, -98], [22, -40]], '#ff4fa3', '#b02a6a', 2);
      c.save(); c.clip(); for (let i = 0; i < 4; i++) line(c, -30, -45 - i * 14, 30, -60 - i * 14, '#ffe14d', 4); c.restore();
      path(c, [[-22, -40], [0, -98], [22, -40]], null, '#b02a6a', 2);
      ellipse(c, 0, -100, 7, 7, '#ffe14d', '#c9a400', 1.5);
    },
    tophat(c) {
      ellipse(c, 0, -42, 40, 9, '#1a1a1a');
      c.fillStyle = '#1a1a1a'; c.beginPath(); c.roundRect(-25, -100, 50, 60, 4); c.fill();
      c.fillStyle = '#b02a2a'; c.fillRect(-25, -56, 50, 9);
      ellipse(c, -12, -88, 4, 10, 'rgba(255,255,255,0.12)');
    },
    cowboy(c) {
      path(c, [[-62, -44], [-40, -36, 0, -38], [40, -36, 62, -44], [50, -30, 0, -30], [-50, -30, -62, -44]], '#9a6a3a', '#5a3a1a', 2);
      path(c, [[-32, -38], [-34, -80, -10, -84], [0, -74, 10, -84], [34, -80, 32, -38]], '#b07a44', '#5a3a1a', 2);
      c.fillStyle = '#5a3a1a'; c.fillRect(-32, -50, 64, 7);
    },
    viking(c) {
      path(c, [[-38, -36], [-40, -82, 0, -84], [40, -82, 38, -36]], '#9aa0a8', '#5a6068', 2);
      c.fillStyle = '#7a5a2a'; c.fillRect(-38, -44, 76, 9);
      for (const s of [-1, 1]) path(c, [[s * 34, -60], [s * 70, -70, s * 66, -112], [s * 56, -80, s * 34, -74]], '#f3ead2', '#a89a7a', 2);
    },
    chef(c) {
      c.fillStyle = '#fff'; c.strokeStyle = '#ccc'; c.lineWidth = 2;
      c.beginPath(); c.roundRect(-26, -64, 52, 26, 3); c.fill(); c.stroke();
      for (const [x, y, r] of [[-20, -76, 18], [0, -86, 22], [20, -76, 18]]) ellipse(c, x, y, r, r, '#fff', '#ccc', 2);
      c.fillStyle = '#fff'; c.fillRect(-24, -72, 48, 14);
    },
    crown(c) {
      path(c, [[-34, -38], [-38, -82], [-18, -60], [0, -90], [18, -60], [38, -82], [34, -38]], '#ffcc33', '#b8860b', 2.5);
      ellipse(c, 0, -52, 6, 6, '#d0202a'); ellipse(c, -20, -48, 4, 4, '#2a6ad0'); ellipse(c, 20, -48, 4, 4, '#2ab04a');
      for (const [x, y] of [[-38, -82], [0, -90], [38, -82]]) ellipse(c, x, y, 4.5, 4.5, '#fff3b0', '#b8860b', 1);
    },
    halo(c) {
      c.save(); c.shadowColor = '#fff59a'; c.shadowBlur = 16;
      ellipse(c, 0, -72, 34, 10, null, '#ffe766', 7);
      c.restore();
    },
  };

  const cache = new Map();
  // Returns an offscreen canvas of the character's face, size px square.
  function avatarCanvas(id, size = 128) {
    const key = id + ':' + size;
    if (cache.has(key)) return cache.get(key);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.translate(size / 2, size / 2);
    ctx.scale(size / (2 * R), size / (2 * R));
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
    (DRAW[id] || DRAW.horse)(ctx);
    cache.set(key, cv);
    return cv;
  }

  // Draw a whole player ball: face, rim, hat. (x,y) centre, r radius in screen px.
  function drawBall(ctx, id, hat, x, y, r, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    // shadow
    ctx.beginPath(); ctx.arc(0, r * 0.08, r * 1.02, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
    const img = avatarCanvas(id, Math.min(256, Math.max(64, Math.ceil(r * 2 * (window.devicePixelRatio || 1) * 1.25))));
    ctx.drawImage(img, -r, -r, r * 2, r * 2);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = opts.heavy ? r * 0.28 : r * 0.1;
    ctx.strokeStyle = opts.heavy ? '#111' : (opts.ring || 'rgba(255,255,255,0.9)');
    ctx.stroke();
    if (opts.heavy) { ctx.lineWidth = r * 0.07; ctx.strokeStyle = opts.ring || '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * 1.14, 0, 7); ctx.stroke(); }
    if (hat && hat !== 'none' && HAT[hat]) {
      ctx.scale(r / R, r / R);
      HAT[hat](ctx);
    }
    ctx.restore();
  }

  function drawHatOnly(ctx, hat, size) {
    ctx.save(); ctx.translate(size / 2, size * 0.95); ctx.scale(size / 130, size / 130);
    (HAT[hat] || HAT.none)(ctx);
    ctx.restore();
  }

  window.Avatars = { avatarCanvas, drawBall, drawFlag, drawHatOnly };
})();
