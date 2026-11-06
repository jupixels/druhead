import { paintify } from '../fx.js';
// Boss 5: The Mixologist, a dapper cocktail shaker.
import { G, W, H, INK, PINK, GROUND, clamp, rand, pick } from '../core.js';
import { ellipse, circle, poly, hose, pieEye, glove, shoe, roundRect, text, starburst, mouth, FONT_TITLE, shadePath } from '../draw.js';
import { Boss } from './base.js';
import { Proj, Enemy, drawPinkOrb, drawCherry } from '../entities.js';
import { play } from '../audio.js';

export class Mix extends Boss {
  constructor(w) {
    super(w, { hp: 1900, phases: [0.66, 0.33], name: 'The Mixologist' });
    this.x = 1060; this.y = GROUND;
    this.setAct('idle'); this.idleFor = 1.2;
    this.shake = 0; this.lidOff = false;
    this.tornado = false; this.tvx = -220; this.umbT = 1.5; this.sawT = 3;
  }
  bodyRect() { return this.tornado ? { x: this.x - 90, y: GROUND - 260, w: 180, h: 255 } : { x: this.x - 80, y: this.y - 400, w: 160, h: 390 }; }
  hitboxes() { if (this.dying) return []; const r = this.bodyRect(); return [{ x: r.x + 10, y: r.y + 20, w: r.w - 20, h: r.h - 20 }]; }
  hurtboxes() { if (this.dying) return []; const r = this.bodyRect(); return [{ x: r.x + 30, y: r.y + 50, w: r.w - 60, h: r.h - 50 }]; }
  onPhase(p, w) {
    if (p === 1) { w.popText(this.x - 80, 200, 'STIRRED, NOT SHAKEN!', '#ff9ccc', 36); play('bell'); this.setAct('idle'); this.idleFor = 0.5; }
    if (p === 2) { w.popText(640, 200, 'ON THE ROCKS!', '#9fd8ff', 50); play('ice'); this.setAct('spinup'); }
  }
  introUpdate(dt, w) { this.t += dt; const k = Math.max(0, 1 - this.t / 0.7); this.x = 1060 + k * k * 520; this.shake = this.t > 0.7 && this.t < 1.4 ? 1.5 : 0; if (this.t > 0.7 && !this.arrived) { this.arrived = true; play('ice'); w.puff(this.x + 60, GROUND, 40); } }

  update(dt, w) {
    this.t += dt; this.actT += dt; this.hitT = Math.max(0, this.hitT - dt);
    const s = this.spd * (this.phase >= 1 ? 1.1 : 1);
    const T = (v) => v / s;
    const tgt = w.nearestPlayer(this.x, this.y);
    this.shake *= 0.9;
    switch (this.act) {
      case 'idle':
        if (this.tornado) { this.setAct('twist'); break; }
        if (this.actT > T(this.idleFor)) this.chooseAct(this.phase === 0 ? ['ice', 'olives', 'shake'] : ['ice', 'olives', 'swizzle', 'juggle', 'shake']);
        break;
      case 'ice':
        if (this.step < 4 && this.actT > T(0.4) + this.step * T(0.45)) {
          const tx = clamp(tgt.x + rand(-150, 150), 60, 900);
          const t = 1.0, sx = this.x - 90, sy = this.y - 330, vy = -800, vx = (tx - sx) / t, g = (2 * (GROUND - 16 - sy - vy * t)) / (t * t);
          w.eBullets.push(new Proj({ x: sx, y: sy, vx, vy, grav: g, r: 18, life: 3, render: drawIce,
            tick: (dt, w, b) => { if (b.y >= GROUND - 16) { b.dead = true; play('ice', { volume: 0.4, vary: 0.2 }); for (const d of [-1, 1]) w.eBullets.push(new Proj({ x: b.x, y: GROUND - 10, vx: d * 360 * s, r: 10, life: 1.4, render: drawShardIce })); } } }));
          this.shake = 1; this.step++;
        }
        if (this.step >= 4 && this.actT > T(2.6)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'olives':
        if (this.step < 5 && this.actT > T(0.5) + this.step * T(0.38)) {
          const y = pick([GROUND - 40, GROUND - 120, GROUND - 230]);
          const pink = this.step === 3;
          w.eBullets.push(new Proj({ x: this.x - 100, y, vx: -560 * s, r: 16, parry: pink, life: 4, render: pink ? (ctx, b) => drawCherry(ctx, b.x, b.y, b.r) : drawOlive }));
          play('whoosh', { rate: 1.5, volume: 0.4 }); this.step++;
        }
        if (this.step >= 5 && this.actT > T(2.4)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'shake':
        if (this.actT < T(1.0)) this.shake = 1.5;
        else if (this.step === 0) {
          this.step = 1; this.lidOff = true; play('cork_pop', { rate: 0.7, volume: 1 }); G.shake = 8;
          for (let i = 0; i < 14; i++) w.eBullets.push(new Proj({ x: this.x, y: this.y - 420, vx: rand(-700, -60), vy: rand(-1100, -600), grav: 1300, r: 12, parry: i === 5, life: 4, render: drawSplash }));
        }
        if (this.actT > T(2.2)) { this.lidOff = false; this.idleFor = 0.7; this.setAct('idle'); }
        break;
      case 'swizzle':
        if (this.step < 2 && this.actT > T(0.4) + this.step * T(1.0)) {
          w.eBullets.push(new Proj({ x: this.x - 100, y: GROUND - 40, vx: -430 * s, vy: 0, r: 34, life: 5, persist: true, killOffscreen: false,
            tick: (dt, w, b) => { if (b.x < 40) { b.vx = Math.abs(b.vx); } if (b.x > 1000 && b.vx > 0) b.dead = true; }, render: drawSwizzle }));
          play('whoosh', { rate: 0.7 }); this.step++;
        }
        if (this.step >= 2 && this.actT > T(4)) { this.idleFor = 0.4; this.setAct('idle'); }
        break;
      case 'juggle':
        // Bottles juggled high, then dropped where the player stands (shadow warns).
        if (this.step < 3 && this.actT > T(0.4) + this.step * T(0.6)) {
          const tx = clamp(tgt.x + rand(-40, 40), 40, 1000);
          w.eBullets.push(new Proj({ x: tx, y: -60, vy: 0, r: 20, life: 4, wait: 0.7 / s, harmlessT: 0, render: drawFallBottle,
            tick: (dt, w, b) => { if (b.t < b.wait) { b.vy = 0; b.y = -60; } else b.vy += 2600 * dt; if (b.y > GROUND - 20) { b.dead = true; play('glass_shatter', { volume: 0.4 }); w.puff(b.x, GROUND - 10, 40, '#e0f4ff'); for (const d of [-1, 1]) w.eBullets.push(new Proj({ x: b.x, y: GROUND - 10, vx: d * 300, r: 10, life: 1, render: drawShardIce })); } } }));
          this.shake = 1; this.step++;
        }
        if (this.step >= 3 && this.actT > T(2.6)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'spinup':
        this.shake = 2;
        if (this.actT > 1.2) { this.tornado = true; this.setAct('twist'); }
        break;
      case 'twist': {
        // Tornado drifts left and right; umbrellas float down; lemon saws roll.
        this.x += this.tvx * s * dt;
        if (this.x < 140) this.tvx = Math.abs(this.tvx);
        if (this.x > 1140) this.tvx = -Math.abs(this.tvx);
        this.umbT -= dt;
        if (this.umbT <= 0) {
          this.umbT = rand(0.7, 1.1) / s;
          const x0 = rand(60, W - 60), ph = rand(0, 6);
          w.eBullets.push(new Proj({ x: x0, y: -40, vy: 120 * s, r: 18, parry: Math.random() < 0.25, life: 8, x0, ph, tick: (dt, w, b) => { b.x = b.x0 + Math.sin(b.t * 2 + b.ph) * 90; }, render: drawUmbrella }));
        }
        this.sawT -= dt;
        if (this.sawT <= 0) {
          this.sawT = rand(2.5, 3.5) / s;
          const fromLeft = Math.random() < 0.5;
          w.eBullets.push(new Proj({ x: fromLeft ? -40 : W + 40, y: GROUND - 32, vx: (fromLeft ? 1 : -1) * 380 * s, r: 30, life: 6, persist: true, killOffscreen: false, render: drawLemonSaw }));
          play('whoosh', { rate: 1.2 });
        }
        break;
      }
    }
  }

  draw(ctx, w) {
    const sh = (this.dying ? Math.sin(this.t * 80) * 5 : this.hitT > 0 ? 2 : 0) + Math.sin(this.t * 60) * this.shake * 4;
    ctx.save(); ctx.translate(this.x + sh, this.y);
    if (this.tornado) { this.drawTornado(ctx); ctx.restore(); return; }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 90, 14, 0, 0, 7); ctx.fill();
    // Legs (pinstripe trousers) + spats
    hose(ctx, -24, -60, -26, -30, -30, -8, 14, '#2a2a3a'); hose(ctx, 24, -60, 26, -30, 30, -8, 14, '#2a2a3a');
    shoe(ctx, -30, 0, -1, '#111', 1.4); shoe(ctx, 30, 0, -1, '#111', 1.4);
    // Shaker body (steel)
    poly(ctx, [[-70, -60], [70, -60], [60, -300], [-60, -300]], '#c9cdd6', 5);
    ctx.beginPath(); ctx.moveTo(-70, -60); ctx.lineTo(70, -60); ctx.lineTo(60, -300); ctx.lineTo(-60, -300); ctx.closePath(); shadePath(ctx, -20, -200, 200, 1.4);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(-48, -290, 16, 220);
    // Tux vest
    poly(ctx, [[-66, -70], [66, -70], [58, -210], [0, -160], [-58, -210]], '#2a2a3a', 4);
    for (let i = 0; i < 3; i++) circle(ctx, 0, -140 + i * 26, 5, '#d9a93a', 2);
    // Bowtie
    poly(ctx, [[0, -205], [-30, -222], [-30, -188]], '#d63a2a', 3); poly(ctx, [[0, -205], [30, -222], [30, -188]], '#d63a2a', 3); circle(ctx, 0, -205, 7, '#d63a2a', 3);
    // Face
    pieEye(ctx, -26, -255, 13, 17, Math.PI, this.hitT > 0.03);
    pieEye(ctx, 18, -255, 13, 17, Math.PI, this.hitT > 0.03);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-40, -232); ctx.quadraticCurveTo(-4, -222, -4, -232); ctx.quadraticCurveTo(-4, -222, 32, -232); ctx.stroke();
    mouth(ctx, -4, -222, 14, 0.25);
    // Cap / lid
    if (!this.lidOff) {
      poly(ctx, [[-60, -300], [60, -300], [40, -350], [-40, -350]], '#c9cdd6', 5);
      roundRect(ctx, -22, -385, 44, 38, 10, '#c9cdd6', 5);
    } else { for (let i = 0; i < 4; i++) circle(ctx, rand(-30, 30), -310 - i * 20, 10, '#ff9ccc', 2); }
    // Arms
    const juggle = this.act === 'ice' || this.act === 'juggle';
    const ja = Math.sin(this.t * 10);
    hose(ctx, -66, -180, -110, -200, -120, juggle ? -280 + ja * 30 : -130, 10, '#2a2a3a');
    glove(ctx, -120, juggle ? -285 + ja * 30 : -130, 13);
    hose(ctx, 66, -180, 110, -200, 120, juggle ? -280 - ja * 30 : -140, 10, '#2a2a3a');
    glove(ctx, 120, juggle ? -285 - ja * 30 : -140, 13);
    if (juggle) { for (let i = 0; i < 3; i++) { const a = this.t * 6 + i * 2.1; roundRect(ctx, Math.cos(a) * 110 - 12, -380 + Math.sin(a) * 50 - 12, 24, 24, 5, '#e0f4ff', 2.5); } }
    ctx.restore();
  }
  drawTornado(ctx) {
    for (let i = 0; i < 6; i++) {
      const y = -30 - i * 42, wv = 50 + i * 16 + Math.sin(this.t * 10 + i) * 8;
      ctx.save(); ctx.translate(Math.sin(this.t * 8 + i) * 10, y);
      ellipse(ctx, 0, 0, wv, 20, i % 2 ? '#c9cdd6' : '#b3e0ff', 3.5);
      ctx.restore();
    }
    ctx.save(); ctx.translate(0, -150); ctx.rotate(this.t * 12);
    roundRect(ctx, -40, -60, 80, 120, 16, '#c9cdd6', 4);
    ctx.restore();
    pieEye(ctx, -20, -170, 12, 16, Math.sin(this.t * 10) * 3, this.hitT > 0.03);
    pieEye(ctx, 18, -170, 12, 16, Math.sin(this.t * 10) * 3, this.hitT > 0.03);
    ellipse(ctx, 0, -130, 18, 10, '#2a0010', 3);
  }
}

function drawIce(ctx, b) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 8); roundRect(ctx, -16, -16, 32, 32, 6, 'rgba(200,235,255,.95)', 3); ctx.fillStyle = '#fff'; ctx.fillRect(-9, -10, 7, 5); ctx.restore(); }
function drawShardIce(ctx, b) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 20); poly(ctx, [[-10, -6], [10, 0], [-10, 6]], '#e0f4ff', 2.5); ctx.restore(); }
function drawOlive(ctx, b) {
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x - 4, b.y); ctx.lineTo(b.x + 40, b.y); ctx.stroke();
  ellipse(ctx, b.x, b.y, b.r, b.r * 0.8, '#7a9a3a', 3); circle(ctx, b.x - 6, b.y, 5, '#d63a2a', 2);
}
function drawSplash(ctx, b) { if (b.parry) return drawPinkOrb(ctx, b.x, b.y, b.r); circle(ctx, b.x, b.y, b.r, '#ffb3d0', 2.5); circle(ctx, b.x - 3, b.y - 4, 3, '#fff', 0); }
function drawSwizzle(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 16);
  for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 1.5); roundRect(ctx, -4, -36, 8, 36, 3, '#ff5fa8', 2.5); }
  circle(ctx, 0, 0, 9, '#ffe14a', 3);
  ctx.restore();
}
function drawFallBottle(ctx, b) {
  if (b.t < b.wait) { const k = b.t / b.wait; ctx.fillStyle = `rgba(0,0,0,${0.15 + k * 0.3})`; ctx.beginPath(); ctx.ellipse(b.x, GROUND, 20 + k * 30, 8, 0, 0, 7); ctx.fill(); return; }
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.PI);
  roundRect(ctx, -14, -26, 28, 52, 8, '#2f5e2c', 3); roundRect(ctx, -6, -40, 12, 16, 3, '#2f5e2c', 2.5);
  ctx.restore();
}
function drawUmbrella(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.sin(b.t * 2 + b.ph) * 0.3);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 28); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(0, -36, 26, 0); ctx.closePath();
  ctx.fillStyle = b.parry ? PINK : pick2(b.x); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function pick2(x) { return ['#ffd84a', '#9fd8ff', '#8dd14f'][Math.floor(Math.abs(x)) % 3]; }
function drawLemonSaw(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 14 * Math.sign(b.vx));
  circle(ctx, 0, 0, b.r, '#ffe14a', 4); circle(ctx, 0, 0, b.r * 0.78, '#fff6b0', 0);
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(b.r * 0.78, 0); ctx.stroke(); }
  ctx.restore();
}

let bg = null;
function buildBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e1a2a'; ctx.fillRect(0, 0, W, H);
  // Art deco sunburst
  for (let i = 0; i < 18; i++) { ctx.fillStyle = i % 2 ? '#2a2438' : '#332c46'; ctx.beginPath(); ctx.moveTo(640, 640); ctx.arc(640, 640, 900, Math.PI + (i / 18) * Math.PI, Math.PI + ((i + 1) / 18) * Math.PI); ctx.fill(); }
  ctx.strokeStyle = '#c9a03a'; ctx.lineWidth = 4;
  for (let r = 200; r < 900; r += 140) { ctx.beginPath(); ctx.arc(640, 640, r, Math.PI, 0); ctx.stroke(); }
  // Back bar shelves with bottles
  for (const y of [300, 420]) {
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(60, y, 360, 14); ctx.fillRect(860, y, 360, 14);
    for (let i = 0; i < 9; i++) for (const x0 of [70, 870]) { const col = ['#2f5e2c', '#7a3a10', '#6e1430', '#cfe8f5', '#d9c46a'][(i + y) % 5]; roundRect(ctx, x0 + i * 38, y - 54, 26, 54, 6, col, 2.5); }
  }
  // Floor (checkerboard)
  for (let x = 0; x < W; x += 64) for (let y = GROUND; y < H; y += 32) { ctx.fillStyle = ((x / 64 + (y - GROUND) / 32) % 2) ? '#e8dcc0' : '#2a2438'; ctx.fillRect(x, y, 64, 32); }
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
  return paintify(c);
}

export const mixLevel = {
  id: 'mix', type: 'boss', name: 'The Mixologist', subtitle: 'Shaken, Stirred & Dangerous', music: 'boss_mix', par: 140,
  introSub: '"Ah, a customer. Allow me to mix you something... lethal."',
  taunt: 'Too strong for you? I did warn you.',
  setup(w) {
    w.boss = new Mix(w);
    w.def.phaseMarks = w.diff === 0 ? [0.34] : [0.34, 0.67];
    // Two coasters that glide back and forth
    w.platforms.push({ x: 160, y: 440, w: 150, vx: 90, min: 80, max: 520 }, { x: 640, y: 360, w: 150, vx: -110, min: 380, max: 900 });
  },
  update(dt, w) { for (const p of w.platforms) { p.x += p.vx * dt; if (p.x < p.min || p.x > p.max) p.vx *= -1; } },
  drawBg(ctx, w) {
    if (!bg) bg = buildBg();
    ctx.drawImage(bg, 0, 0);
    // Neon sign
    const on = Math.floor(G.time * 2) % 6 !== 0;
    ctx.save(); ctx.shadowColor = '#ff7ad9'; ctx.shadowBlur = on ? 20 : 0;
    text(ctx, 'THE LOUNGE', 640, 80, 54, on ? '#ffb3ec' : '#6a4a64', 'center', FONT_TITLE, 0);
    ctx.restore();
  },
  drawPlatform(ctx, p) {
    ellipse(ctx, p.x + p.w / 2, p.y + 8, p.w / 2, 14, '#d63a2a', 4);
    ellipse(ctx, p.x + p.w / 2, p.y + 4, p.w / 2 - 14, 8, '#f3e6c4', 2);
  },
};
