// Boss 4 (flying stage): Captain Rumbeard and his airship, the Rum Runner.
import { G, W, H, INK, PINK, clamp, rand, pick } from '../core.js';
import { ellipse, circle, poly, hose, pieEye, glove, roundRect, text, starburst, mouth, FONT_TITLE } from '../draw.js';
import { Boss } from './base.js';
import { Proj, Enemy, drawPinkOrb } from '../entities.js';
import { Plane } from '../plane.js';
import { play } from '../audio.js';

export class Rum extends Boss {
  constructor(w) {
    super(w, { hp: 1700, phases: [0.66, 0.33], name: 'Captain Rumbeard' });
    this.x = 1060; this.y = 380; this.baseY = 380;
    this.balloon = true; this.rocket = false;
    this.setAct('idle'); this.idleFor = 1.3;
    this.anchorA = 0;
  }
  bodyRect() {
    if (this.rocket) return { x: this.x - 80, y: this.y - 70, w: 160, h: 140 };
    return { x: this.x - 150, y: this.y - 90, w: 300, h: 200 };
  }
  hitboxes() {
    if (this.dying) return [];
    if (this.rocket) return [this.bodyRect()];
    // Hull and the captain on deck
    return [{ x: this.x - 150, y: this.y - 20, w: 300, h: 130 }, { x: this.x - 40, y: this.y - 130, w: 80, h: 110, mult: 1.1 }];
  }
  hurtboxes() {
    if (this.dying) return [];
    const r = this.bodyRect();
    const out = [{ x: r.x + 20, y: r.y + 30, w: r.w - 40, h: r.h - 40 }];
    if (this.act === 'anchor' && this.step >= 1) { const p = this.anchorPos(); out.push({ x: p.x - 36, y: p.y - 30, w: 72, h: 64 }); }
    return out;
  }
  anchorPos() { const L = 820; return { x: 640 + Math.sin(this.anchorA) * L, y: -300 + Math.cos(this.anchorA) * L }; }
  onPhase(p, w) {
    if (p === 1) { this.balloon = false; play('cork_pop', { rate: 0.5, volume: 1 }); w.popText(this.x - 100, 150, 'ABANDON SHIP... NOT!', '#ffb347', 36); this.baseY = 470; this.setAct('idle'); }
    if (p === 2) { this.rocket = true; play('boss_explode'); G.shake = 14; w.explode(this.x, this.y, 1.6); w.popText(640, 150, 'RUM ROCKET!', '#ff6a3d', 50); this.setAct('idle'); this.y = 300; }
  }
  introUpdate(dt) { this.t += dt; this.y = this.baseY + Math.sin(this.t * 1.5) * 12; }

  update(dt, w) {
    this.t += dt; this.actT += dt; this.hitT = Math.max(0, this.hitT - dt);
    const s = this.spd * (this.phase >= 1 ? 1.1 : 1);
    const T = (v) => v / s;
    const tgt = w.nearestPlayer(this.x, this.y);
    if (!this.rocket) this.y += (this.baseY + Math.sin(this.t * 1.5) * 16 - this.y) * Math.min(1, dt * 3);
    else { this.x += (900 + Math.sin(this.t * 0.9) * 200 - this.x) * dt * 1.5; this.y += (360 + Math.sin(this.t * 1.7) * 220 - this.y) * dt * 1.5; }
    switch (this.act) {
      case 'idle':
        if (this.actT > T(this.idleFor)) this.chooseAct(this.rocket ? ['fan', 'slash', 'parrots'] : this.phase === 0 ? ['cannons', 'parrots', 'anchor'] : ['cannons', 'kegs', 'parrots', 'anchor']);
        break;
      case 'cannons':
        if (this.step < 4 && this.actT > T(0.5) + this.step * T(0.4)) {
          const ox = this.x - 150, oy = this.y + 40 + (this.step % 2) * 40;
          const a = Math.atan2(tgt.y - oy, tgt.x - ox);
          w.eBullets.push(new Proj({ x: ox, y: oy, vx: Math.cos(a) * 520 * s, vy: Math.sin(a) * 520 * s, r: 18, parry: this.step === 3, life: 4, color: '#333' }));
          w.puff(ox, oy, 30, '#ddd'); play('bomb', { volume: 0.4, rate: 1.4 });
          this.step++;
        }
        if (this.step >= 4 && this.actT > T(2.2)) { this.idleFor = 0.7; this.setAct('idle'); }
        break;
      case 'parrots':
        if (this.step < 5 && this.actT > T(0.3) + this.step * T(0.35)) {
          const y0 = rand(80, H - 100), ph = rand(0, 6);
          w.enemies.push(new Enemy({ x: W + 40, y: y0, w: 50, h: 40, hp: 6, parry: this.step === 2, y0, ph,
            tick: (dt, w, e) => { e.x -= 360 * s * dt; e.y = e.y0 + Math.sin(e.t * 4 + e.ph) * 70; if (e.x < -60) e.dead = true; },
            render: drawParrot }));
          this.step++;
        }
        if (this.step >= 5 && this.actT > T(2.0)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'anchor':
        // An anchor on a chain swings across the screen.
        if (this.step === 0) { this.anchorA = 0.9; if (this.actT > T(0.6)) { this.step = 1; play('whoosh', { rate: 0.5 }); } }
        else if (this.step === 1) { this.anchorA -= dt * 1.25 * s; if (this.anchorA < -1.0) { this.step = 2; } }
        else if (this.step === 2) { this.anchorA += dt * 1.25 * s; if (this.anchorA > 0.9) { this.idleFor = 0.6; this.setAct('idle'); } }
        break;
      case 'kegs':
        if (this.step < 2 && this.actT > T(0.4) + this.step * T(0.9)) {
          const tx = clamp(tgt.x + rand(-100, 100), 120, 700), ty = clamp(tgt.y + rand(-80, 80), 80, H - 80);
          const k = new Enemy({ x: this.x - 100, y: this.y, w: 54, h: 60, hp: 12, tx, ty, fuse: 1.8 / s,
            tick: (dt, w, e) => { e.x += (e.tx - e.x) * dt * 2; e.y += (e.ty + 30 - e.y) * dt * 2; e.fuse -= dt; if (e.fuse <= 0) { e.dead = true; kegBurst(w, e.x, e.y - 30, s); } },
            render: drawKeg });
          k.onDeath = (w, e) => { w.popEnemy(e); };
          w.enemies.push(k);
          play('whoosh'); this.step++;
        }
        if (this.step >= 2 && this.actT > T(2.8)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'fan':
        if (this.step < 3 && this.actT > T(0.4) + this.step * T(0.5)) {
          const a0 = Math.atan2(tgt.y - this.y, tgt.x - this.x);
          for (let i = -2; i <= 2; i++) w.eBullets.push(new Proj({ x: this.x - 60, y: this.y, vx: Math.cos(a0 + i * 0.2) * 420 * s, vy: Math.sin(a0 + i * 0.2) * 420 * s, r: 14, parry: this.step === 1 && i === 0, life: 4, render: drawBottle }));
          play('shoot_whiskey', { rate: 0.7 }); this.step++;
        }
        if (this.step >= 3 && this.actT > T(1.8)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'slash':
        if (this.step < 2 && this.actT > T(0.6) + this.step * T(0.7)) {
          const up = this.step === 0;
          w.eBullets.push(new Proj({ x: this.x - 80, y: this.y, vx: -620 * s, r: 0, life: 3, persist: true, up,
            rect: function () { return { x: this.x - 20, y: this.y - 120, w: 40, h: 240 }; },
            tick: (dt, w, b) => { b.y += (b.up ? -1 : 1) * 60 * dt; },
            render(ctx, b) { ctx.save(); ctx.translate(b.x, b.y); ctx.beginPath(); ctx.arc(60, 0, 130, Math.PI * 0.7, Math.PI * 1.3); ctx.arc(90, 0, 120, Math.PI * 1.27, Math.PI * 0.73, true); ctx.closePath(); ctx.fillStyle = '#e0f4ff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore(); } }));
          play('whoosh', { rate: 0.8 }); this.step++;
        }
        if (this.step >= 2 && this.actT > T(2.0)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
    }
  }

  draw(ctx, w) {
    const shake = this.dying ? Math.sin(this.t * 80) * 5 : this.hitT > 0 ? 2 : 0;
    if (this.act === 'anchor' && this.step >= 1) {
      const p = this.anchorPos(), px = 640, py = -300;
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.setLineDash([10, 6]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(p.x, p.y - 30); ctx.stroke(); ctx.setLineDash([]);
      drawAnchor(ctx, p.x, p.y);
    }
    ctx.save(); ctx.translate(this.x + shake, this.y);
    if (this.rocket) { this.drawRocket(ctx); ctx.restore(); return; }
    // Balloon
    if (this.balloon) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3; for (const x of [-100, 0, 100]) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x * 0.8, -160); ctx.stroke(); }
      ellipse(ctx, 0, -240, 190, 100, '#c9762a', 5);
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; for (const x of [-120, -60, 0, 60, 120]) { ctx.beginPath(); ctx.ellipse(0, -240, Math.abs(x) + 5, 100, 0, 0, 7); ctx.stroke(); }
      roundRect(ctx, -40, -260, 80, 40, 8, '#f3e6c4', 3);
      text(ctx, 'RUM', 0, -240, 26, '#7a1c1c', 'center', FONT_TITLE, 0);
    } else {
      for (let i = 0; i < 3; i++) circle(ctx, -40 + i * 40, -60 - ((this.t * 60 + i * 30) % 90), 16, 'rgba(120,120,120,.6)', 0);
    }
    // Captain on deck
    const cy = -70;
    roundRect(ctx, -30, cy - 60, 60, 90, 16, '#7a3a10', 4);
    roundRect(ctx, -14, cy - 90, 28, 34, 6, '#7a3a10', 4);
    poly(ctx, [[-50, cy - 92], [50, cy - 92], [30, cy - 120], [0, cy - 106], [-30, cy - 120]], '#222', 4);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, cy - 104, 6, 0, 7); ctx.fill();
    pieEye(ctx, -12, cy - 30, 9, 12, Math.PI, this.hitT > 0.03);
    ellipse(ctx, 12, cy - 30, 10, 10, INK, 0); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-30, cy - 46); ctx.lineTo(30, cy - 20); ctx.stroke();
    ctx.fillStyle = '#e8732a'; ctx.beginPath(); ctx.moveTo(-26, cy - 10); ctx.quadraticCurveTo(0, cy + 40, 26, cy - 10); ctx.quadraticCurveTo(0, cy + 6, -26, cy - 10); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    // Hull (a barrel boat)
    ctx.beginPath(); ctx.moveTo(-170, -20); ctx.lineTo(170, -20); ctx.quadraticCurveTo(160, 100, 100, 110); ctx.lineTo(-110, 110); ctx.quadraticCurveTo(-170, 90, -190, -10); ctx.closePath();
    ctx.fillStyle = '#8a5a2a'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = '#444'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-175, 20); ctx.lineTo(165, 20); ctx.moveTo(-150, 80); ctx.lineTo(140, 80); ctx.stroke();
    for (const [x, y] of [[-150, 40], [-150, 80]]) { roundRect(ctx, x - 26, y - 12, 34, 24, 6, '#333', 3); }
    // Skull & crossbones flag
    ctx.fillStyle = INK; ctx.fillRect(120, -150, 5, 130);
    poly(ctx, [[125, -150], [190 + Math.sin(this.t * 5) * 6, -135], [125, -110]], '#222', 3);
    circle(ctx, 150, -132, 8, '#fff', 0);
    ctx.restore();
  }
  drawRocket(ctx) {
    ctx.save(); ctx.rotate(Math.PI);
    for (let i = 0; i < 3; i++) poly(ctx, [[-90, -16 + i * 16], [-140 - Math.random() * 40, -8 + i * 8], [-90, -4 + i * 16]], i === 1 ? '#ffe14a' : '#ff8a1e', 2);
    roundRect(ctx, -90, -40, 170, 80, 30, '#7a3a10', 5);
    roundRect(ctx, 70, -18, 50, 36, 8, '#7a3a10', 4);
    roundRect(ctx, -40, -30, 60, 60, 6, '#f3e6c4', 3);
    ctx.restore();
    // Captain riding on top
    roundRect(ctx, -10, -110, 50, 74, 14, '#7a3a10', 4);
    poly(ctx, [[-20, -110], [60, -110], [44, -136], [15, -122], [-10, -136]], '#222', 4);
    pieEye(ctx, 0, -84, 9, 12, Math.PI, this.hitT > 0.03); ellipse(ctx, 24, -84, 10, 10, INK, 0);
    ctx.fillStyle = '#e8732a'; ctx.beginPath(); ctx.moveTo(-6, -66); ctx.quadraticCurveTo(15, -20, 36, -66); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.strokeStyle = '#ccc'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-10, -70); ctx.quadraticCurveTo(-60, -110, -50, -150); ctx.stroke();
  }
}

function kegBurst(w, x, y, s) {
  w.explode(x, y, 0.8); play('bomb');
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; w.eBullets.push(new Proj({ x, y, vx: Math.cos(a) * 300 * s, vy: Math.sin(a) * 300 * s, r: 12, parry: i === 0, life: 4, color: '#ffb347' })); }
}
function drawParrot(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y - 20);
  const flap = Math.sin(e.t * 20) * 14;
  const c = e.parry ? PINK : '#3aa84a';
  poly(ctx, [[0, -4], [24, -20 - flap], [30, 2]], c, 3);
  ellipse(ctx, 0, 0, 26, 16, c, 3);
  poly(ctx, [[-24, -4], [-38, 2], [-24, 8]], '#ffd84a', 2.5);
  pieEye(ctx, -14, -6, 5, 6, Math.PI);
  poly(ctx, [[22, 4], [40, 14], [22, 12]], '#d63a2a', 2.5);
  ctx.restore();
}
function drawKeg(ctx, e) {
  const r = e.rect();
  roundRect(ctx, r.x, r.y, r.w, r.h, 12, '#8a5a2a', 3.5);
  ctx.fillStyle = '#444'; ctx.fillRect(r.x, r.y + 12, r.w, 6); ctx.fillRect(r.x, r.y + r.h - 18, r.w, 6);
  text(ctx, 'XXX', r.x + r.w / 2, r.y + r.h / 2, 16, '#f3e6c4', 'center', FONT_TITLE, 3);
  if (Math.floor(e.fuse * 8) % 2) starburst(ctx, r.x + r.w / 2, r.y - 8, 10, 5, '#ffe14a', 0, 2);
}
function drawBottle(ctx, b) {
  if (b.parry) return drawPinkOrb(ctx, b.x, b.y, b.r);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 10);
  roundRect(ctx, -7, -14, 14, 28, 5, '#7a3a10', 2.5); roundRect(ctx, -3, -20, 6, 8, 2, '#7a3a10', 2);
  ctx.restore();
}
function drawAnchor(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, 30); ctx.moveTo(-30, 10); ctx.quadraticCurveTo(0, 50, 30, 10); ctx.moveTo(-16, -16); ctx.lineTo(16, -16); ctx.stroke();
  ctx.strokeStyle = '#666'; ctx.lineWidth = 8; ctx.stroke();
  circle(ctx, 0, -38, 9, '#666', 3);
  ctx.restore();
}

export const rumLevel = {
  id: 'rum', type: 'plane', name: 'Captain Rumbeard', subtitle: 'Terror of the Tipsy Skies', music: 'boss_rum', par: 130,
  introSub: '"Yo ho ho! Ye\'ll be walkin\' the plank... from up here!"',
  taunt: 'Har! Shot down like a cheap bottle o\' grog!',
  makePlayer(i, w, lo) { return new Plane(i, 200, 300 + i * 120, lo); },
  setup(w) { w.boss = new Rum(w); w.def.phaseMarks = w.diff === 0 ? [0.34] : [0.34, 0.67]; w.clouds = Array.from({ length: 9 }, (_, i) => ({ x: rand(0, W), y: rand(40, 400), s: rand(0.5, 1.2) })); },
  groundAt() { return 99999; },
  drawBg(ctx, w) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fc8e8'); g.addColorStop(0.75, '#f3e6c4'); g.addColorStop(1, '#f0c890');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Sea far below
    ctx.fillStyle = '#3f7f8f'; ctx.fillRect(0, H - 70, W, 70);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3;
    for (let x = -((w.t * 120) % 80); x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, H - 50); ctx.quadraticCurveTo(x + 20, H - 60, x + 40, H - 50); ctx.stroke(); }
    for (const c of w.clouds) {
      c.x -= 90 * c.s * (1 / 60);
      if (c.x < -200) { c.x = W + 200; c.y = rand(40, 420); }
      ctx.globalAlpha = 0.85;
      for (const [dx, dy, r] of [[0, 0, 40], [40, -14, 50], [90, 0, 38], [45, 14, 40]]) circle(ctx, c.x + dx * c.s, c.y + dy * c.s, r * c.s, '#fffbea', 3);
      ctx.globalAlpha = 1;
    }
  },
};
