// Run-and-gun levels: Pub Crawl and Vineyard Dash.
import { G, W, H, INK, PINK, GROUND, clamp, rand, pick } from './core.js';
import { ellipse, circle, poly, roundRect, text, pieEye, starburst, mouth, FONT_TITLE, FONT_UI } from './draw.js';
import { Proj, Enemy, drawPinkOrb, drawCherry } from './entities.js';
import { drawCoin } from './scenes/map.js';
import { play } from './audio.js';

// ---------- Generic enemy makers ----------
const MAKERS = {
  runner: (x, y, o) => new Enemy({ x, y, w: 46, h: 50, hp: 8, vx: -(o.speed || 200), vy: 0, look: o.look,
    tick(dt, w, e) { e.vy += 2400 * dt; e.x += e.vx * dt; e.y += e.vy * dt; const g = w.groundAt(e.x); if (e.y >= g && g < 9000) { e.y = g; e.vy = 0; if (o.hop && Math.random() < 0.02) e.vy = -700; } if (e.y > 900) e.dead = true; },
    render: o.look === 'grape' ? drawGrapeRunner : drawRat }),
  flyer: (x, y, o) => new Enemy({ x, y, w: 50, h: 40, hp: 6, y0: y, parry: !!o.pink, look: o.look,
    tick(dt, w, e) { e.x -= (o.speed || 180) * dt; e.y = e.y0 + Math.sin(e.t * 3) * 60; }, render: o.look === 'bee' ? drawBee : drawBat }),
  turret: (x, y, o) => new Enemy({ x, y, w: 60, h: 80, hp: 22, cd: 1.5, look: o.look,
    tick(dt, w, e) { e.cd -= dt; const p = w.nearestPlayer(e.x, e.y); if (e.cd <= 0 && Math.abs(p.x - e.x) < 900) { e.cd = 1.8; const a = Math.atan2(p.y - 50 - (e.y - 70), p.x - e.x); w.eBullets.push(new Proj({ x: e.x, y: e.y - 70, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 12, parry: Math.random() < 0.25, life: 4, color: '#c08a4a' })); play('cork_pop', { volume: 0.4, vary: 0.2 }); } },
    render: drawTurret }),
  roller: (x, y, o) => new Enemy({ x, y, w: 70, h: 70, hp: 16, vx: -(o.speed || 320), rot: 0,
    tick(dt, w, e) { e.vy = (e.vy || 0) + 2400 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.rot += e.vx / 35 * dt; const g = w.groundAt(e.x); if (e.y >= g && g < 9000) { e.y = g; e.vy = 0; } if (e.y > 900) e.dead = true; },
    render: drawRoller }),
};

function makeRunLevel(cfg) {
  return {
    id: cfg.id, type: 'run', name: cfg.name, subtitle: cfg.subtitle, music: 'run', par: cfg.par,
    introText: 'RUN \'N\' GUN!', introSub: cfg.introSub, taunt: cfg.taunt, winText: 'BOTTOMS UP!',
    spawnX: 160,
    setup(w) {
      w.length = cfg.length;
      w.segs = cfg.ground;
      w.spawns = cfg.enemies.map((e) => ({ ...e, done: false }));
      w.coinIds = [];
      w.lockX = cfg.mini ? cfg.mini.lock : null;
      w.mini = null; w.miniDone = !cfg.mini;
      for (const p of cfg.platforms) w.platforms.push({ ...p });
      cfg.coins.forEach(([x, y], i) => {
        const id = `${cfg.id}:${i}`;
        if (G.save.coinsFound[id]) return;
        w.pickups.push({ x, y, id, dead: false, draw(ctx) { drawCoin(ctx, this.x, this.y + Math.sin(G.time * 4 + this.x) * 4, G.time); }, collect(w) { this.dead = true; w.coinIds.push(this.id); w.stats.coins++; play('coin'); w.popText(this.x, this.y - 30, 'COIN!', '#ffd84a', 22); } });
      });
      for (const [x, y] of cfg.cherries) w.eBullets.push(new Proj({ x, y, r: 18, parry: true, harmless: true, life: 9999, killOffscreen: false, render: (ctx, b) => drawCherry(ctx, b.x, b.y + Math.sin(G.time * 3 + b.x) * 6, b.r), onParry(w) { this.dead = true; } }));
      w.flagX = cfg.length - 180;
    },
    groundAt(x, w) { for (const s of w.segs) if (x >= s[0] && x <= s[1]) return s[2]; return 99999; },
    safeX(p, w) { for (const s of w.segs) { const x = Math.max(s[0] + 40, w.camX + 120); if (x < s[1] - 40) return x; } return w.camX + 200; },
    progress(w) { const lead = Math.max(...w.players.map((p) => p.x)); return clamp(lead / w.flagX, 0, 1); },
    update(dt, w) {
      const alive = w.alivePlayers();
      const lead = alive.length ? Math.max(...alive.map((p) => p.x)) : w.camX + 400;
      const maxCam = w.lockX !== null && !w.miniDone ? w.lockX : w.length - W;
      w.camX = clamp(Math.max(w.camX, lead - 520), 0, maxCam);
      w.bounds.left = w.camX + 20; w.bounds.right = w.camX + W - 20;
      if (w.mini && !w.miniDone) w.bounds.right = Math.min(w.bounds.right, w.mini.rect().x + 30);
      for (const s of w.spawns) if (!s.done && w.camX + W + 80 > s.x) { s.done = true; w.enemies.push(MAKERS[s.type](s.x, s.y ?? GROUND, s)); }
      // Mini-boss
      if (cfg.mini && !w.mini && !w.miniDone && w.camX >= cfg.mini.lock - 1) { w.mini = cfg.mini.make(w); w.enemies.push(w.mini); w.popText(w.camX + 640, 200, cfg.mini.name.toUpperCase() + '!', '#ffb347', 44); play('roar'); }
      if (w.mini && w.mini.dead && !w.miniDone) { w.miniDone = true; w.popText(w.camX + 640, 200, 'KEEP GOING!', '#ffe39a', 40); play('bell'); }
      // Finish line
      if (alive.some((p) => p.x >= w.flagX)) { w.win(); }
    },
    drawBg: cfg.drawBg,
    drawMid(ctx, w) {
      cfg.drawGround(ctx, w);
      // Finish flag
      const fx = w.flagX, fy = w.groundAt(fx);
      ctx.fillStyle = INK; ctx.fillRect(fx - 3, fy - 200, 6, 200);
      poly(ctx, [[fx + 3, fy - 200], [fx + 90 + Math.sin(G.time * 5) * 6, fy - 180], [fx + 3, fy - 150]], '#ffe39a', 3);
      text(ctx, 'FINISH', fx + 40, fy - 178, 14, '#7a1c1c', 'center', FONT_TITLE, 0);
    },
    drawPlatform: cfg.drawPlatform,
    hud(ctx, w) {
      const k = this.progress(w);
      roundRect(ctx, W / 2 - 200, 20, 400, 14, 7, '#3b2a1c', 2);
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(W / 2 - 198, 22, 396 * k, 10);
    },
  };
}

// ---------- Mini-bosses ----------
function jukebox(w) {
  const x = 2900 + W - 260;
  const e = new Enemy({ x, y: GROUND, w: 200, h: 300, hp: 260, contact: true, keepOnKo: false, cd: 1, mode: 0,
    tick(dt, w, e) {
      e.cd -= dt;
      if (e.cd <= 0) {
        e.mode = (e.mode + 1) % 2; e.cd = 1.6;
        if (e.mode === 0) for (let i = 0; i < 5; i++) { const by = GROUND - 120 - i * 30; w.eBullets.push(new Proj({ x: e.x - 100, y: by, vx: -300, r: 15, parry: i === 2, life: 6, by, ph: i, tick: (dt, w, b) => { b.y = b.by + Math.sin(b.t * 4 + b.ph) * 40; }, render: (ctx, b) => b.parry ? drawPinkOrb(ctx, b.x, b.y, b.r) : (circle(ctx, b.x, b.y + 4, 11, '#fff3d0', 3), ctx.fillStyle = INK, ctx.fillRect(b.x + 8, b.y - 20, 4, 24)) })); }
        else w.eBullets.push(new Proj({ x: e.x - 100, y: GROUND - 30, vx: -420, vy: -600, grav: 1800, r: 26, life: 5, render: drawRecord, tick: (dt, w, b) => { if (b.y > GROUND - 26) { b.y = GROUND - 26; b.vy = -700; } } }));
        play('shoot_wine', { rate: 0.6 });
      }
    },
    render(ctx, e) {
      const r = e.rect();
      roundRect(ctx, r.x, r.y + 60, r.w, r.h - 60, 20, '#8a3a1a', 5);
      ctx.beginPath(); ctx.moveTo(r.x, r.y + 100); ctx.arc(r.x + r.w / 2, r.y + 100, r.w / 2, Math.PI, 0); ctx.fillStyle = '#c9762a'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
      for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#ff5fa8', '#ffe14a', '#8dd14f', '#9fd8ff', '#ff8a1e'][(i + Math.floor(G.time * 4)) % 5]; ctx.fillRect(r.x + 20 + i * 34, r.y + 130, 24, 60); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(r.x + 20, r.y + 130, 164, 60);
      pieEye(ctx, r.x + 60, r.y + 80, 16, 20, Math.PI); pieEye(ctx, r.x + 130, r.y + 80, 16, 20, Math.PI);
      roundRect(ctx, r.x + 50, r.y + 220, 100, 40, 6, '#3a0a0a', 4);
      text(ctx, 'JUKEBOX JOE', r.x + r.w / 2, r.y + 290, 16, '#ffd84a', 'center', FONT_TITLE, 3);
    },
    onDeath(w, e) { w.explode(e.x, e.y - 150, 2); play('boss_explode'); G.shake = 14; },
  });
  return e;
}
function winePress(w) {
  const x = 3300 + W - 260;
  const e = new Enemy({ x, y: GROUND, w: 220, h: 280, hp: 300, contact: true, cd: 1.2, slam: 0, mode: 0,
    tick(dt, w, e) {
      e.cd -= dt; e.slam = Math.max(0, e.slam - dt * 2);
      if (e.cd <= 0) {
        e.mode = (e.mode + 1) % 3; e.cd = 1.4;
        if (e.mode === 2) { e.slam = 1; G.shake = 10; play('slam'); for (const d of [-1]) w.eBullets.push(new Proj({ x: e.x - 120, y: GROUND - 24, vx: -480, r: 24, life: 3, rect: function () { return { x: this.x - 22, y: GROUND - 44, w: 44, h: 44 }; }, render: (ctx, b) => { ctx.beginPath(); ctx.moveTo(b.x - 30, GROUND); ctx.quadraticCurveTo(b.x - 10, GROUND - 60, b.x + 24, GROUND); ctx.fillStyle = '#8a1a3a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); } })); }
        else for (let i = 0; i < 4; i++) w.eBullets.push(new Proj({ x: e.x - 80, y: GROUND - 220, vx: -rand(250, 650), vy: -rand(500, 900), grav: 1500, r: 12, parry: i === 1 && e.mode === 1, life: 3, render: (ctx, b) => b.parry ? drawPinkOrb(ctx, b.x, b.y, b.r) : circle(ctx, b.x, b.y, b.r, '#7b2d8e', 2.5) }));
      }
    },
    render(ctx, e) {
      const r = e.rect(); const s = e.slam * 60;
      roundRect(ctx, r.x + 10, r.y + 120, r.w - 20, r.h - 120, 10, '#8a5a2a', 5);
      ctx.fillStyle = '#6e1430'; ctx.fillRect(r.x + 20, r.y + 200, r.w - 40, 60);
      ctx.fillStyle = INK; ctx.fillRect(r.x + r.w / 2 - 10, r.y - 40, 20, 160 + s);
      roundRect(ctx, r.x - 10, r.y + 60 + s, r.w + 20, 50, 8, '#6b4220', 5);
      roundRect(ctx, r.x + 30, r.y - 70, r.w - 60, 30, 8, '#888', 4);
      pieEye(ctx, r.x + 70, r.y + 160, 15, 19, Math.PI); pieEye(ctx, r.x + 140, r.y + 160, 15, 19, Math.PI);
      text(ctx, 'THE WINE PRESS', r.x + r.w / 2, r.y + 275, 16, '#ffd84a', 'center', FONT_TITLE, 3);
    },
    onDeath(w, e) { w.explode(e.x, e.y - 150, 2); play('boss_explode'); G.shake = 14; },
  });
  return e;
}

// ---------- Pub Crawl ----------
const pubGround = [[0, 900, GROUND], [1040, 1700, GROUND], [1700, 2200, GROUND - 90], [2340, 2900 + W, GROUND], [2900 + W + 1, 5600, GROUND], [5760, 6400, GROUND - 60], [6520, 7400, GROUND]];
export const pubcrawlLevel = makeRunLevel({
  id: 'pubcrawl', name: 'Pub Crawl', subtitle: 'A Night on Tavern Row', par: 150, length: 7400,
  introSub: 'Dodge the drunks and reach the end of Tavern Row!', taunt: 'Too many stops on this crawl, pal.',
  ground: pubGround,
  platforms: [{ x: 880, y: 495, w: 180 }, { x: 2180, y: 450, w: 170 }, { x: 4400, y: 495, w: 200 }, { x: 4750, y: 400, w: 200 }, { x: 5560, y: 495, w: 200 }, { x: 6360, y: 470, w: 170 }],
  coins: [[970, 445], [2260, 400], [4850, 350], [5900, 480], [7000, 560]],
  cherries: [[1400, 470], [3600, 460], [6100, 400]],
  enemies: [
    { x: 1300, type: 'runner' }, { x: 1500, type: 'runner' }, { x: 1600, type: 'flyer', y: 320 },
    { x: 2050, type: 'turret', y: GROUND - 90 }, { x: 2600, type: 'runner', speed: 260 }, { x: 2800, type: 'flyer', y: 280, pink: true },
    { x: 4200, type: 'roller' }, { x: 4500, type: 'flyer', y: 260 }, { x: 4700, type: 'runner' }, { x: 5000, type: 'turret' },
    { x: 5300, type: 'runner' }, { x: 5500, type: 'flyer', y: 300 }, { x: 6000, type: 'turret', y: GROUND - 60 }, { x: 6600, type: 'roller' },
    { x: 6800, type: 'runner', speed: 300 }, { x: 6900, type: 'flyer', y: 330 },
  ],
  mini: { lock: 2900, name: 'Jukebox Joe', make: jukebox },
  drawBg(ctx, w) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a1a3a'); g.addColorStop(1, '#4a3a5a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fffbea'; ctx.beginPath(); ctx.arc(1050, 110, 50, 0, 7); ctx.fill(); ctx.fillStyle = '#1a1a3a'; ctx.beginPath(); ctx.arc(1075, 95, 46, 0, 7); ctx.fill();
    for (let i = 0; i < 30; i++) { ctx.fillStyle = '#fff'; ctx.fillRect((i * 173) % W, (i * 97) % 300, 2, 2); }
    // Parallax skyline
    for (const [par, col, base] of [[0.2, '#2a2a4a', 360], [0.45, '#3a2a3a', 420]]) {
      const off = -(w.camX * par) % 1280;
      for (let k = 0; k < 2; k++) for (let i = 0; i < 10; i++) {
        const bx = off + k * 1280 + i * 128, bh = 120 + ((i * 53) % 160);
        ctx.fillStyle = col; ctx.fillRect(bx, base - bh + 200, 120, bh + 400);
        ctx.fillStyle = 'rgba(255,220,120,.55)'; for (let wy = 0; wy < 4; wy++) for (let wx = 0; wx < 3; wx++) if ((i + wx + wy) % 3) ctx.fillRect(bx + 14 + wx * 36, base - bh + 220 + wy * 40, 16, 20);
      }
    }
  },
  drawGround(ctx, w) {
    for (const [a, b, y] of w.segs) {
      if (b < w.camX - 50 || a > w.camX + W + 50) continue;
      ctx.fillStyle = '#5a4a4a'; ctx.fillRect(a, y, b - a, H - y + 50);
      ctx.fillStyle = '#7a6a6a'; ctx.fillRect(a, y, b - a, 14);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(a, y, b - a, H - y + 60);
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2;
      for (let x = a + 20; x < b; x += 40) for (let yy = y + 26; yy < H; yy += 26) { ctx.beginPath(); ctx.ellipse(x + ((yy / 26) % 2) * 20, yy, 16, 9, 0, 0, 7); ctx.stroke(); }
      // Street lamps + tavern doors along the street
      for (let x = Math.ceil(a / 500) * 500; x < b - 40; x += 500) {
        ctx.fillStyle = INK; ctx.fillRect(x - 3, y - 170, 6, 170); circle(ctx, x, y - 176, 12, '#ffe680', 3);
        roundRect(ctx, x + 120, y - 130, 90, 130, 6, '#2e1a0c', 4);
        roundRect(ctx, x + 105, y - 170, 120, 34, 6, '#7a1c1c', 3);
        text(ctx, pick2(x), x + 165, y - 153, 14, '#ffd84a', 'center', FONT_TITLE, 0);
      }
    }
  },
  drawPlatform(ctx, p) {
    roundRect(ctx, p.x, p.y, p.w, 20, 4, '#9a6030', 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x + 14, p.y + 20); ctx.lineTo(p.x + 14, p.y + 60); ctx.moveTo(p.x + p.w - 14, p.y + 20); ctx.lineTo(p.x + p.w - 14, p.y + 60); ctx.stroke();
  },
});
function pick2(x) { return ['THE TIPSY TAP', 'MOE\'S', 'SUDS', 'THE FLAGON', 'HIC-CUP INN', 'BARREL HOUSE'][Math.floor(x / 500) % 6]; }

// ---------- Vineyard Dash ----------
const vinGround = [[0, 1200, GROUND], [1340, 2000, GROUND], [2140, 2500, GROUND - 80], [2640, 3300 + W, GROUND], [3300 + W + 1, 5200, GROUND], [5340, 5700, GROUND - 100], [5840, 6500, GROUND], [6640, 7800, GROUND]];
export const vineyardLevel = makeRunLevel({
  id: 'vineyard', name: 'Vineyard Dash', subtitle: 'Hills of Grapes and Barrels', par: 160, length: 7800,
  introSub: 'Race through the vineyard before the harvest gets you!', taunt: 'Crushed like a grape!',
  ground: vinGround,
  platforms: [{ x: 1180, y: 495, w: 180 }, { x: 1980, y: 495, w: 180 }, { x: 2480, y: 440, w: 180 }, { x: 4600, y: 495, w: 220 }, { x: 5180, y: 495, w: 180 }, { x: 5680, y: 440, w: 180 }, { x: 6480, y: 495, w: 180 }],
  coins: [[1270, 445], [2560, 390], [4700, 445], [5480, 440], [7400, 560]],
  cherries: [[1650, 450], [4300, 470], [6200, 430]],
  enemies: [
    { x: 900, type: 'runner', look: 'grape', hop: true }, { x: 1100, type: 'flyer', y: 300, look: 'bee' }, { x: 1500, type: 'roller', speed: 360 },
    { x: 1800, type: 'runner', look: 'grape', hop: true }, { x: 2300, type: 'turret', y: GROUND - 80 }, { x: 2800, type: 'flyer', y: 260, look: 'bee', pink: true },
    { x: 3000, type: 'runner', look: 'grape', hop: true, speed: 260 }, { x: 4500, type: 'roller' }, { x: 4800, type: 'flyer', y: 300, look: 'bee' },
    { x: 5000, type: 'turret' }, { x: 5500, type: 'runner', look: 'grape', hop: true }, { x: 6000, type: 'roller', speed: 380 }, { x: 6300, type: 'flyer', y: 280, look: 'bee' },
    { x: 6900, type: 'turret' }, { x: 7100, type: 'runner', look: 'grape', hop: true }, { x: 7300, type: 'flyer', y: 320, look: 'bee' },
  ],
  mini: { lock: 3300, name: 'The Wine Press', make: winePress },
  drawBg(ctx, w) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f0a060'); g.addColorStop(1, '#f7d08a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffe39a'; ctx.beginPath(); ctx.arc(900, 200, 80, 0, 7); ctx.fill();
    for (const [par, col, y0, amp] of [[0.15, '#c98a5a', 420, 60], [0.35, '#8daa5a', 480, 50]]) {
      const off = w.camX * par;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 + Math.sin((x + off) * 0.006) * amp);
      ctx.lineTo(W, H); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    }
    // Vine rows
    const off = -(w.camX * 0.6) % 160;
    for (let x = off; x < W; x += 160) { ctx.fillStyle = '#6b4220'; ctx.fillRect(x, 500, 8, 80); ctx.fillStyle = '#4f8a3a'; ctx.beginPath(); ctx.ellipse(x + 4, 500, 40, 18, 0, 0, 7); ctx.fill(); for (let k = 0; k < 3; k++) circle(ctx, x - 14 + k * 14, 520, 6, '#7b2d8e', 1.5); }
  },
  drawGround(ctx, w) {
    for (const [a, b, y] of w.segs) {
      if (b < w.camX - 50 || a > w.camX + W + 50) continue;
      ctx.fillStyle = '#8a5a30'; ctx.fillRect(a, y, b - a, H - y + 50);
      ctx.fillStyle = '#6a9a3a'; ctx.fillRect(a, y, b - a, 16);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(a, y, b - a, H - y + 60);
      ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let x = a + 30; x < b; x += 70) { ctx.beginPath(); ctx.arc(x, y + 50 + (x % 3) * 20, 8, 0, 7); ctx.fill(); }
    }
  },
  drawPlatform(ctx, p) {
    roundRect(ctx, p.x, p.y, p.w, 40, 4, '#a8783a', 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.w, p.y + 40); ctx.moveTo(p.x + p.w, p.y); ctx.lineTo(p.x, p.y + 40); ctx.stroke();
  },
});

// ---------- Enemy art ----------
function drawRat(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y);
  const b = Math.abs(Math.sin(e.t * 14)) * 4;
  ellipse(ctx, 0, -22 - b, 26, 18, '#8a7a7a', 3);
  circle(ctx, -22, -32 - b, 13, '#8a7a7a', 3); circle(ctx, -18, -46 - b, 7, '#f0b0b0', 2);
  pieEye(ctx, -28, -34 - b, 4, 5, Math.PI);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(24, -22 - b); ctx.quadraticCurveTo(44, -40, 40, -10); ctx.stroke();
  roundRect(ctx, 6, -60 - b, 18, 26, 4, '#2f5e2c', 2.5);
  ctx.restore();
}
function drawGrapeRunner(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-10, 0); ctx.moveTo(8, -10); ctx.lineTo(10, 0); ctx.stroke();
  circle(ctx, 0, -28, 22, '#7b2d8e', 3); pieEye(ctx, -8, -32, 5, 7, Math.PI); pieEye(ctx, 6, -32, 5, 7, Math.PI);
  ctx.restore();
}
function drawBat(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y - 20);
  const f = Math.sin(e.t * 18) * 16;
  const c = e.parry ? PINK : '#3a2a4a';
  poly(ctx, [[-6, 0], [-40, -10 - f], [-30, 10]], c, 3); poly(ctx, [[6, 0], [40, -10 - f], [30, 10]], c, 3);
  roundRect(ctx, -10, -18, 20, 36, 6, e.parry ? PINK : '#2f5e2c', 3);
  pieEye(ctx, -4, -6, 3, 4, Math.PI); pieEye(ctx, 5, -6, 3, 4, Math.PI);
  ctx.restore();
}
function drawBee(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y - 20);
  const f = Math.sin(e.t * 30) * 8;
  ellipse(ctx, 6, -18 - f, 12, 7, 'rgba(255,255,255,.8)', 2);
  ellipse(ctx, 0, 0, 22, 16, e.parry ? PINK : '#ffd84a', 3);
  if (!e.parry) { ctx.fillStyle = INK; ctx.fillRect(-4, -15, 6, 30); ctx.fillRect(8, -13, 5, 26); }
  pieEye(ctx, -12, -4, 4, 5, Math.PI);
  ctx.restore();
}
function drawTurret(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y);
  roundRect(ctx, -26, -80, 52, 80, 12, '#2f5e2c', 3.5);
  roundRect(ctx, -10, -100, 20, 24, 4, '#2f5e2c', 3);
  roundRect(ctx, -8, -112, 16, 14, 3, '#c08a4a', 2.5);
  ctx.fillStyle = '#f3e6c4'; ctx.fillRect(-20, -60, 40, 26);
  pieEye(ctx, -9, -48, 5, 7, Math.PI); pieEye(ctx, 9, -48, 5, 7, Math.PI);
  ctx.restore();
}
function drawRoller(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y - 35); ctx.rotate(e.rot);
  circle(ctx, 0, 0, 35, '#9b5a2a', 4);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 24, 0, 7); ctx.stroke();
  ctx.restore();
}
function drawRecord(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 10);
  circle(ctx, 0, 0, b.r, '#222', 3); circle(ctx, 0, 0, 9, '#d63a2a', 2);
  ctx.restore();
}
