// Boss 3: The Agave Brothers, two cactus luchadores (Blanco and Reposado).
import { G, W, H, INK, PINK, GROUND, clamp, rand, pick } from '../core.js';
import { ellipse, circle, poly, hose, pieEye, glove, shoe, roundRect, text, starburst, FONT_TITLE } from '../draw.js';
import { Boss } from './base.js';
import { Proj, Enemy, drawPinkOrb } from '../entities.js';
import { play } from '../audio.js';

const POST_X = 1150, POST_Y = GROUND - 250; // top of the right turnbuckle

class Bro {
  constructor(name, color, mask, x, y) {
    Object.assign(this, { name, color, mask, x, y, vx: 0, vy: 0, ball: false, rot: 0, facing: -1, squash: 1, air: false, hp: 1 });
  }
}

export class Agave extends Boss {
  constructor(w) {
    super(w, { hp: 1900, phases: [0.66, 0.33], name: 'The Agave Brothers' });
    this.blanco = new Bro('Blanco', '#6aa84f', '#e8e8f0', 900, GROUND);
    this.repo = new Bro('Reposado', '#4f8a3a', '#d9a93a', POST_X, POST_Y);
    this.setAct('idle'); this.idleFor = 1.2;
    this.giant = false; this.gx = 980; this.sweep = 0; this.sweepY = 0;
    this.bloomT = 2;
  }
  bodyRect() { return this.giant ? { x: this.gx - 110, y: GROUND - 470, w: 220, h: 460 } : this.broRect(this.blanco); }
  broRect(b) { return b.ball ? { x: b.x - 55, y: b.y - 110, w: 110, h: 110 } : { x: b.x - 55, y: b.y - 190, w: 110, h: 185 }; }
  hitboxes() {
    if (this.dying) return [];
    if (this.giant) { const r = this.bodyRect(); return [{ x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.h - 20 }]; }
    return [this.broRect(this.blanco), this.broRect(this.repo)];
  }
  hurtboxes() {
    if (this.dying) return [];
    const out = [];
    if (this.giant) {
      const r = this.bodyRect(); out.push({ x: r.x + 30, y: r.y + 40, w: r.w - 60, h: r.h - 40 });
      if (this.sweep > 0.05) { const ax = this.gx - 110 - this.sweep * 760; out.push({ x: ax, y: this.sweepY - 30, w: this.sweep * 760, h: 60 }); }
      return out;
    }
    for (const b of [this.blanco, this.repo]) { const r = this.broRect(b); out.push({ x: r.x + 18, y: r.y + 18, w: r.w - 36, h: r.h - 18 }); }
    return out;
  }
  onPhase(p, w) {
    if (p === 1) { this.setAct('tag'); w.popText(640, 200, 'TAG TEAM!', '#ffb347', 50); play('bell'); play('roar'); }
    if (p === 2) { this.setAct('fuse'); w.popText(640, 200, 'EL GIGANTE!', '#ff6a3d', 56); play('roar', { rate: 0.7 }); G.shake = 12; }
  }
  introUpdate(dt) { this.t += dt; }

  update(dt, w) {
    this.t += dt; this.actT += dt; this.hitT = Math.max(0, this.hitT - dt);
    const s = this.spd * (this.phase >= 1 ? 1.12 : 1);
    const T = (v) => v / s;
    const tgt = w.nearestPlayer(this.blanco.x, GROUND);
    const B = this.blanco, R = this.repo;
    for (const b of [B, R]) b.squash += (1 - b.squash) * Math.min(1, dt * 8);
    switch (this.act) {
      case 'idle':
        if (this.giant) { this.setAct('gidle'); break; }
        // Return to positions
        B.ball = false;
        B.x += clamp((this.phase ? 300 : 900) - B.x, -400 * dt, 400 * dt);
        if (this.actT > T(this.idleFor)) this.chooseAct(this.phase === 0 ? ['roll', 'spines', 'elbow'] : ['roll', 'spines', 'spikes', 'limes', 'elbow']);
        break;
      case 'roll':
        // Blanco curls into a spiky ball and rolls across the ring and back.
        if (this.step === 0) { B.ball = true; B.squash = 0.7; if (this.actT > T(0.5)) { this.step = 1; B.vx = (B.x > 640 ? -1 : 1) * 820 * s; play('whoosh', { rate: 0.6 }); } }
        else if (this.step === 1) {
          B.x += B.vx * dt; B.rot += (B.vx / 55) * dt;
          if ((B.vx < 0 && B.x < 70) || (B.vx > 0 && B.x > 1080)) { B.vx *= -1; this.step = 2; G.shake = 6; play('slam', { volume: 0.4, rate: 1.4 }); B.y = GROUND; if (this.phase >= 1) B.vy = -900; }
        } else if (this.step === 2) {
          B.x += B.vx * dt; B.rot += (B.vx / 55) * dt;
          if (B.vy || B.y < GROUND) { B.vy += 2400 * dt; B.y += B.vy * dt; if (B.y >= GROUND) { B.y = GROUND; B.vy = 0; } }
          const home = this.phase ? 300 : 900;
          if ((B.vx > 0 && B.x >= home && B.x > 640) || (B.vx < 0 && B.x <= home && B.x < 640) || B.x < 60 || B.x > 1100) { B.ball = false; B.vx = 0; B.y = GROUND; this.idleFor = 0.7; this.setAct('idle'); }
        }
        break;
      case 'spines': {
        // Reposado fires aimed volleys of cactus needles from the turnbuckle (or the ground in phase 2).
        const shooter = R;
        if (this.step < 3 && this.actT > T(0.5) + this.step * T(0.55)) {
          const ox = shooter.x - 40, oy = shooter.y - 130;
          const a = Math.atan2(tgt.y - 50 - oy, tgt.x - ox);
          for (const d of [-0.16, 0, 0.16]) w.eBullets.push(new Proj({ x: ox, y: oy, vx: Math.cos(a + d) * 520 * s, vy: Math.sin(a + d) * 520 * s, r: 11, parry: this.step === 1 && d === 0, life: 4, render: drawNeedle }));
          play('shoot_whiskey', { rate: 0.6, volume: 0.6 });
          shooter.squash = 1.1; this.step++;
        }
        if (this.step >= 3 && this.actT > T(2.2)) { this.idleFor = 0.7; this.setAct('idle'); }
        break;
      }
      case 'elbow':
        // Reposado leaps off the post and lands an elbow drop on the player.
        if (this.step === 0) { R.squash = 0.8; if (this.actT > T(0.5)) { this.step = 1; this.ex = clamp(tgt.x, 120, 1000); R.vy = -1300; play('whoosh', { rate: 0.7 }); } }
        else if (this.step === 1) { R.vy += 2600 * dt; R.y += R.vy * dt; R.x += (this.ex - R.x) * dt * 2.2; if (R.vy > 0 && R.y >= GROUND) { R.y = GROUND; this.step = 2; this.actT = 0; G.shake = 14; play('slam');
            for (const d of [-1, 1]) w.eBullets.push(new Proj({ x: R.x + d * 70, y: GROUND - 20, vx: d * 460 * s, r: 20, life: 3, rect: function () { return { x: this.x - 18, y: GROUND - 36, w: 36, h: 36 }; }, render: drawDust }));
          } }
        else if (this.step === 2 && this.actT > T(0.8)) { this.step = 3; R.vy = -1400; }
        else if (this.step === 3) { R.vy += 2600 * dt; R.y += R.vy * dt; R.x += (POST_X - R.x) * dt * 2.5; if (R.vy > 0 && R.y >= POST_Y) { R.y = POST_Y; R.x = POST_X; this.idleFor = 0.8; this.setAct('idle'); } }
        break;
      case 'tag':
        // Blanco leaps over to the far corner: now they flank you.
        { const k = Math.min(1, this.actT / 1.0); if (this.step === 0) { this.fromX = B.x; this.step = 1; play('whoosh', { rate: 0.6 }); }
          B.x = this.fromX + (300 - this.fromX) * k; B.y = GROUND - Math.sin(k * Math.PI) * 380; B.ball = k < 1; B.rot -= dt * 10; }
        if (this.actT > 1.2) { B.y = GROUND; B.ball = false; this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'spikes':
        // Rows of spines burst up from the canvas; jump over each one.
        if (this.step < 4 && this.actT > T(0.4) + this.step * T(0.45)) {
          const x0 = tgt.x + (this.step - 1.5) * 150;
          spike(w, clamp(x0, 40, 1240), s);
          this.step++;
        }
        if (this.step >= 4 && this.actT > T(2.2)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'limes':
        if (this.step < 2 && this.actT > T(0.4) + this.step * T(0.8)) {
          const from = this.step === 0 ? B : R;
          const dir = from.x < 640 ? 1 : -1;
          const sx = from.x, sy = GROUND - 140, low = this.step === 0;
          w.eBullets.push(new Proj({ x: sx, y: sy, r: 24, persist: true, life: 3.4, killOffscreen: false, parry: this.step === 1,
            tick: (dt, w, b) => { const k = b.t / 3; b.x = sx + dir * Math.sin(k * Math.PI) * 1000; b.y = (low ? GROUND - 50 : GROUND - 200) + Math.cos(k * Math.PI * 2) * 40; if (k > 1) b.dead = true; },
            render: drawLimeSpin }));
          play('whoosh'); this.step++;
        }
        if (this.step >= 2 && this.actT > T(3.6)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'fuse':
        // Reposado climbs onto Blanco's shoulders: El Gigante.
        { const k = Math.min(1, this.actT / 1.2); if (this.step === 0) { this.fromX = B.x; this.step = 1; }
          B.x = this.fromX + (this.gx - this.fromX) * k; B.y = GROUND - Math.sin(k * Math.PI) * 420; B.ball = k < 1; B.rot += dt * 10;
          R.x += (this.gx - R.x) * dt * 3; R.y += ((GROUND - 230) - R.y) * dt * 3; }
        if (this.actT > 1.4) { this.giant = true; this.setAct('gidle'); }
        break;
      case 'gidle':
        this.sweep = Math.max(0, this.sweep - dt * 3);
        this.bloomT -= dt;
        if (this.bloomT <= 0) { this.bloomT = 2.6 / s; bloom(w, this.gx + rand(-60, 60), GROUND - 470, s); }
        if (this.actT > T(1.0)) this.chooseAct(['gsweep', 'spikes2', 'gsweep']);
        break;
      case 'gsweep':
        // Giant arm sweeps low or high across the ring.
        if (this.step === 0) { this.high = Math.random() < 0.5; this.sweepY = this.high ? GROUND - 110 : GROUND - 30; this.step = 1; }
        if (this.actT < T(0.7)) this.sweep = 0;
        else if (this.actT < T(0.7) + 0.3) { this.sweep = Math.min(1, this.sweep + dt * 4); if (this.step === 1) { play('whoosh', { rate: 0.6 }); this.step = 2; } }
        else if (this.actT < T(0.7) + 0.6) this.sweep = 1;
        else { this.sweep = Math.max(0, this.sweep - dt * 3); if (this.sweep <= 0) this.setAct('gidle'); }
        break;
      case 'spikes2':
        if (this.step < 5 && this.actT > T(0.3) + this.step * T(0.35)) { spike(w, 60 + this.step * 160 + rand(-20, 20), s); this.step++; }
        if (this.step >= 5 && this.actT > T(1.8)) this.setAct('gidle');
        break;
    }
  }
  deathUpdate(dt, w) { super.deathUpdate(dt, w); this.sweep = Math.max(0, this.sweep - dt * 3); }

  draw(ctx, w) {
    // Ring posts + ropes behind
    if (this.giant) return this.drawGiant(ctx);
    if (this.act === 'elbow' && this.step === 1) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(this.ex, GROUND, 60, 12, 0, 0, 7); ctx.fill(); }
    this.drawBro(ctx, this.repo, this.act === 'spines');
    this.drawBro(ctx, this.blanco, false);
  }
  drawBro(ctx, b, shooting) {
    const shake = this.dying ? Math.sin(this.t * 80) * 4 : this.hitT > 0 ? 2 : 0;
    ctx.save(); ctx.translate(b.x + shake, b.y);
    if (b.ball) {
      ctx.translate(0, -55); ctx.rotate(b.rot);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 50, Math.sin(a) * 50); ctx.lineTo(Math.cos(a) * 68, Math.sin(a) * 68); ctx.stroke(); }
      circle(ctx, 0, 0, 55, b.color, 4);
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(i * 20, 0, 6, 48, 0, 0, 7); ctx.stroke(); }
      roundRect(ctx, -30, -20, 60, 30, 10, b.mask, 3);
      ctx.restore(); return;
    }
    const sq = b.squash;
    ctx.scale(1 / Math.sqrt(sq), sq);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 60, 10, 0, 0, 7); ctx.fill();
    // Legs + wrestling boots
    hose(ctx, -20, -40, -24, -20, -28, -8, 12, '#d63a2a');
    hose(ctx, 20, -40, 24, -20, 28, -8, 12, '#d63a2a');
    shoe(ctx, -28, 0, -1, '#d63a2a', 1.2); shoe(ctx, 28, 0, -1, '#d63a2a', 1.2);
    // Body (cactus) with trunks
    roundRect(ctx, -50, -190, 100, 160, 45, b.color, 4);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3; for (const x of [-25, 0, 25]) { ctx.beginPath(); ctx.moveTo(x, -180); ctx.lineTo(x, -40); ctx.stroke(); }
    ctx.strokeStyle = '#f3e6c4'; ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const x = -40 + (i * 23) % 80, y = -170 + (i * 37) % 120; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y - 4); ctx.stroke(); }
    roundRect(ctx, -52, -70, 104, 40, 10, '#2b4f8f', 4);
    roundRect(ctx, -18, -66, 36, 30, 6, '#ffd84a', 3);
    // Arms
    const flex = Math.sin(this.t * 6 + b.x) * 6;
    roundRect(ctx, -90, -170 + flex, 34, 70, 17, b.color, 4);
    roundRect(ctx, 56, -170 - flex, 34, 70, 17, b.color, 4);
    // Luchador mask
    ellipse(ctx, 0, -150, 44, 34, b.mask, 4);
    poly(ctx, [[-40, -168], [0, -150], [40, -168], [30, -180], [0, -166], [-30, -180]], '#d63a2a', 2.5);
    pieEye(ctx, -18, -150, 11, 14, Math.PI);
    pieEye(ctx, 14, -150, 11, 14, Math.PI);
    ctx.fillStyle = INK; ctx.fillRect(-14, -128, 24, 6);
    // Flower on head
    for (let i = 0; i < 5; i++) { const a = i * 1.256 + this.t; circle(ctx, Math.cos(a) * 10, -196 + Math.sin(a) * 10, 9, '#ff7ab0', 2.5); }
    circle(ctx, 0, -196, 7, '#ffe14a', 2);
    if (shooting) text(ctx, '!', -60, -230, 40, '#ff5030', 'center', FONT_TITLE, 5);
    ctx.restore();
  }
  drawGiant(ctx) {
    const shake = this.dying ? Math.sin(this.t * 80) * 5 : this.hitT > 0 ? 2 : 0;
    ctx.save(); ctx.translate(this.gx + shake, GROUND);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 130, 18, 0, 0, 7); ctx.fill();
    roundRect(ctx, -100, -470, 200, 460, 90, '#5a9a3a', 5);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3; for (const x of [-50, 0, 50]) { ctx.beginPath(); ctx.moveTo(x, -450); ctx.lineTo(x, -30); ctx.stroke(); }
    // Two masks stacked
    for (const [y, m] of [[-370, '#d9a93a'], [-200, '#e8e8f0']]) {
      ellipse(ctx, 0, y, 60, 46, m, 4);
      pieEye(ctx, -24, y, 15, 19, Math.PI, this.hitT > 0.03); pieEye(ctx, 22, y, 15, 19, Math.PI, this.hitT > 0.03);
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-44, y - 30); ctx.lineTo(-10, y - 20); ctx.moveTo(44, y - 30); ctx.lineTo(10, y - 20); ctx.stroke();
    }
    roundRect(ctx, -104, -100, 208, 50, 12, '#2b4f8f', 4);
    // Sweeping arm
    const len = 60 + this.sweep * 760;
    const ay = this.sweep > 0.05 ? this.sweepY - GROUND : -280;
    const wind = this.act === 'gsweep' && this.actT < 0.7 / this.spd;
    if (wind) { roundRect(ctx, -150, (this.high ? -170 : -90) - 30, 60, 60, 26, '#5a9a3a', 4); text(ctx, '!', -40, -520, 56, '#ff5030', 'center', FONT_TITLE, 6); }
    else roundRect(ctx, -100 - len, ay - 26, len, 52, 26, '#5a9a3a', 4);
    roundRect(ctx, 90, -320, 60, 120, 30, '#5a9a3a', 4);
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + this.t; circle(ctx, Math.cos(a) * 18, -478 + Math.sin(a) * 18, 14, '#ff7ab0', 3); }
    circle(ctx, 0, -478, 12, '#ffe14a', 3);
    ctx.restore();
  }
}

function spike(w, x, s) {
  w.eBullets.push(new Proj({ x, y: GROUND, r: 30, life: 1.6, harmless: true, persist: true,
    tick: (dt, w, b) => { if (b.t > 0.65 && !b.up) { b.up = true; b.harmless = false; play('slam', { rate: 1.8, volume: 0.3 }); } },
    rect: function () { return this.up ? { x: this.x - 22, y: GROUND - 90, w: 44, h: 90 } : { x: 0, y: -999, w: 0, h: 0 }; },
    render(ctx, b) {
      if (!b.up) { ctx.fillStyle = 'rgba(60,30,10,.6)'; ctx.beginPath(); ctx.ellipse(b.x, GROUND + 2, 30 + Math.sin(b.t * 40) * 3, 6, 0, 0, 7); ctx.fill(); return; }
      const k = Math.min(1, (b.t - 0.65) * 10) * (b.life < 0.2 ? b.life / 0.2 : 1);
      for (const dx of [-14, 0, 14]) poly(ctx, [[b.x + dx - 10, GROUND], [b.x + dx, GROUND - 90 * k * (dx ? 0.8 : 1)], [b.x + dx + 10, GROUND]], '#8dbb5a', 3);
    } }));
}
function bloom(w, x, y, s) {
  play('cork_pop', { rate: 0.8 });
  const n = 8, off = Math.random();
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * Math.PI * 2;
    w.eBullets.push(new Proj({ x, y, vx: Math.cos(a) * 260 * s, vy: Math.sin(a) * 260 * s + 80, r: 13, parry: i === 0, life: 5, render: drawPetal }));
  }
}
function drawNeedle(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
  if (b.parry) { ctx.restore(); return drawPinkOrb(ctx, b.x, b.y, b.r); }
  poly(ctx, [[-20, -4], [16, 0], [-20, 4]], '#f3e6c4', 2.5);
  ctx.restore();
}
function drawPetal(ctx, b) {
  if (b.parry) return drawPinkOrb(ctx, b.x, b.y, b.r);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 6);
  ellipse(ctx, 0, 0, 14, 8, '#ff7ab0', 2.5);
  ctx.restore();
}
function drawLimeSpin(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 14);
  circle(ctx, 0, 0, b.r, b.parry ? PINK : '#8fd14f', 3.5);
  circle(ctx, 0, 0, b.r * 0.7, b.parry ? '#ffc0dc' : '#e6f7a0', 0);
  for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.strokeStyle = b.parry ? '#ff5fa8' : '#8fd14f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(b.r * 0.7, 0); ctx.stroke(); }
  ctx.restore();
}
function drawDust(ctx, b) {
  circle(ctx, b.x, GROUND - 18, 20 + Math.sin(b.t * 20) * 3, '#e8d29a', 3);
  circle(ctx, b.x - Math.sign(b.vx) * 18, GROUND - 12, 13, '#e8d29a', 3);
}

// ---- Arena ----
let bg = null;
function buildBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f0a050'); g.addColorStop(0.6, '#f7d08a'); g.addColorStop(1, '#e8b070');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Sun
  ctx.fillStyle = '#ffe39a'; ctx.beginPath(); ctx.arc(640, 330, 150, 0, 7); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
  // Mesas
  ctx.fillStyle = '#b5603a';
  poly(ctx, [[0, 470], [60, 330], [260, 330], [320, 470]], '#b5603a', 4);
  poly(ctx, [[900, 470], [960, 360], [1190, 360], [1280, 430], [1280, 470]], '#a8502e', 4);
  // Bleachers with crowd
  ctx.fillStyle = '#7a4a20'; ctx.fillRect(0, 430, W, 120);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(-5, 430, W + 10, 120);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 26; i++) { ctx.fillStyle = ['#d63a2a', '#2b4f8f', '#ffd84a', '#5a9a3a'][(i + r) % 4]; ctx.beginPath(); ctx.arc(20 + i * 50 + r * 12, 460 + r * 32, 14, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
  // Ring mat
  ctx.fillStyle = '#e8e0d0'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#2b4f8f'; ctx.fillRect(0, GROUND + 20, W, H - GROUND);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
  // Posts
  for (const x of [20, POST_X + 60]) { roundRect(ctx, x - 14, GROUND - 260, 28, 260, 6, '#ddd', 4); roundRect(ctx, x - 20, GROUND - 270, 40, 26, 6, '#d63a2a', 4); }
  return c;
}

export const agaveLevel = {
  id: 'agave', type: 'boss', name: 'The Agave Brothers', subtitle: 'Tag-Team Luchadores', music: 'boss_agave', par: 140,
  introSub: '"¡Dos contra uno, amigo! Two against one!"',
  taunt: 'Ay ay ay! Pinned for the three count!',
  setup(w) { w.boss = new Agave(w); w.def.phaseMarks = w.diff === 0 ? [0.34] : [0.34, 0.67]; },
  drawBg(ctx, w) {
    if (!bg) bg = buildBg();
    ctx.drawImage(bg, 0, 0);
    for (const [y, c] of [[GROUND - 200, '#d63a2a'], [GROUND - 130, '#f3e6c4'], [GROUND - 60, '#2b4f8f']]) {
      ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(POST_X + 60, y); ctx.stroke();
      ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.stroke();
    }
  },
};
