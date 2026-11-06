import { paintify } from '../fx.js';
// Boss 2: Madame Merlot, the opera-singing wine bottle.
import { G, W, H, INK, PINK, GROUND, clamp, rand, pick, wob } from '../core.js';
import { ellipse, circle, poly, hose, pieEye, glove, roundRect, text, starburst, mouth, FONT_TITLE, shadePath } from '../draw.js';
import { Boss } from './base.js';
import { Proj, Enemy, drawPinkOrb } from '../entities.js';
import { play } from '../audio.js';

export class Merlot extends Boss {
  constructor(w) {
    super(w, { hp: 1700, phases: [0.66, 0.33], name: 'Madame Merlot' });
    this.x = 1060; this.y = GROUND;
    this.setAct('idle'); this.idleFor = 1.4;
    this.sing = 0; this.corked = true;
    this.spirit = false; this.sx = 900; this.sy = 200; this.svx = 0; this.svy = 0;
    this.spinT = 0;
    this.rise = 1;
  }
  bodyRect() {
    if (this.spirit) return { x: this.sx - 90, y: this.sy - 90, w: 180, h: 180 };
    return { x: this.x - 95, y: this.y - 470, w: 190, h: 460 };
  }
  hitboxes() {
    if (this.dying) return [];
    const r = this.bodyRect();
    if (this.spirit) return [{ x: r.x + 20, y: r.y + 20, w: r.w - 40, h: r.h - 40 }];
    return [{ x: r.x + 10, y: r.y + 60, w: r.w - 20, h: r.h - 60 }];
  }
  hurtboxes() {
    if (this.dying) return [];
    const r = this.bodyRect();
    if (this.spirit) return [{ x: r.x + 40, y: r.y + 40, w: r.w - 80, h: r.h - 80 }];
    return [{ x: r.x + 30, y: r.y + 120, w: r.w - 60, h: r.h - 120 }];
  }
  onPhase(p, w) {
    if (p === 1) { this.setAct('uncork'); w.popText(this.x - 80, 200, 'INTERMISSION!', '#ff9ccc', 44); }
    if (p === 2) {
      this.setAct('shatter');
      w.popText(this.x - 80, 200, 'THE FINALE!', '#ff6a8a', 50);
      play('glass_shatter'); G.shake = 14;
      w.debris(this.x, this.y - 250, '#3d6b35', 16, 26);
    }
  }
  introUpdate(dt, w) { this.t += dt; this.sing = Math.max(0, Math.sin(this.t * 4)); this.rise = Math.max(0, 1 - this.t / 0.9); if (this.t > 0.9 && !this.risen) { this.risen = true; play('bell'); w.puff(this.x - 80, GROUND, 50); w.puff(this.x + 80, GROUND, 50); } }

  update(dt, w) {
    this.t += dt; this.actT += dt; this.hitT = Math.max(0, this.hitT - dt);
    const s = this.spd * (this.phase >= 1 ? 1.1 : 1);
    const T = (v) => v / s;
    const tgt = w.nearestPlayer(this.x, this.y);
    this.sing = Math.max(0, this.sing - dt * 2);
    switch (this.act) {
      case 'idle':
        if (this.spirit) { this.setAct('float'); break; }
        if (this.actT > T(this.idleFor)) this.chooseAct(this.phase === 0 ? ['aria', 'grapes', 'highnote'] : ['aria', 'corks', 'minions', 'highnote']);
        break;
      case 'aria': {
        // A stream of musical notes in waves; every 4th note is pink.
        this.sing = 1;
        const n = 10;
        if (this.step < n && this.actT > T(0.5) + this.step * T(0.22)) {
          const k = this.step;
          const by = this.y - 330, amp = 120, ph = k * 0.6;
          w.eBullets.push(new Proj({ x: this.x - 80, y: by, vx: -330 * s, r: 18, parry: k % 4 === 3, life: 7,
            tick: (dt, w, b) => { b.y = by + Math.sin(b.t * 2.6 + ph) * amp; }, render: drawNote }));
          this.step++;
        }
        if (this.step >= n && this.actT > T(3.2)) { this.idleFor = 0.8; this.setAct('idle'); }
        break;
      }
      case 'grapes':
        if (this.step < 3 && this.actT > T(0.5) + this.step * T(0.7)) {
          const tx = clamp(tgt.x + rand(-120, 120), 80, 800);
          const t = 1.1, vx = (tx - (this.x - 100)) / t, vy = -900;
          w.eBullets.push(new Proj({ x: this.x - 100, y: this.y - 380, vx, vy, grav: (2 * ((GROUND - 20) - (this.y - 380) - vy * t)) / (t * t), r: 26, life: 4, render: drawBunch,
            tick: (dt, w, b) => { if (b.y > GROUND - 20) { b.dead = true; burstGrapes(w, b.x); } } }));
          play('whoosh', { vary: 0.2 });
          this.step++;
        }
        if (this.step >= 3 && this.actT > T(3)) { this.idleFor = 0.7; this.setAct('idle'); }
        break;
      case 'highnote':
        this.sing = 1;
        if (this.step < 3 && this.actT > T(0.8) + this.step * T(0.9)) {
          const cx = this.x - 60, cy = this.y - 330;
          const gapY = this.step === 1 ? rand(GROUND - 350, GROUND - 250) : GROUND - rand(40, 140);
          ringWave(w, cx, cy, gapY, 520 * s);
          play('glass_shatter', { rate: 1.8, volume: 0.35 });
          G.shake = 4;
          this.step++;
        }
        if (this.step >= 3 && this.actT > T(4.4)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'uncork':
        if (this.actT > 0.6 && this.corked) { this.corked = false; play('cork_pop', { rate: 0.6, volume: 1 }); G.shake = 8; w.puff(this.x, this.y - 480, 60, '#e0a0c0'); }
        if (this.actT > 1.4) { this.idleFor = 0.4; this.setAct('idle'); }
        break;
      case 'corks':
        if (this.step < 3 && this.actT > T(0.4) + this.step * T(0.6)) {
          const pink = this.step === 2;
          w.enemies.push(new Enemy({ x: this.x, y: this.y - 470, w: 40, h: 50, hp: 10, vx: rand(-260, -60), vy: -800, parry: pink, homing: 0,
            tick: (dt, w, e) => {
              const p = w.nearestPlayer(e.x, e.y);
              if (e.t < 0.8) { e.vy += 1500 * dt; }
              else {
                const a = Math.atan2(p.y - 50 - (e.y - 25), p.x - e.x);
                const sp = 300 * s;
                e.vx += (Math.cos(a) * sp - e.vx) * dt * 2; e.vy += (Math.sin(a) * sp - e.vy) * dt * 2;
              }
              e.x += e.vx * dt; e.y += e.vy * dt;
              e.ang = Math.atan2(e.vy, e.vx);
              if (e.t > 6) { e.dead = true; w.popEnemy(e); }
            },
            render: drawCork }));
          // Make the pink cork disappear when parried.
          const e = w.enemies[w.enemies.length - 1];
          e.onParry = (w) => { e.dead = true; w.popEnemy(e); };
          play('cork_pop', { vary: 0.2 });
          this.step++;
        }
        if (this.step >= 3 && this.actT > T(3.2)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'minions':
        if (this.step < 4 && this.actT > T(0.3) + this.step * T(0.5)) {
          w.enemies.push(new Enemy({ x: this.x - 110, y: GROUND, w: 40, h: 46, hp: 6, vx: -220 * s, vy: 0, hop: 0, coinless: true,
            tick: (dt, w, e) => {
              e.vy += 2200 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
              if (e.y >= GROUND) { e.y = GROUND; e.vy = -rand(500, 800); }
              if (e.x < -60) e.dead = true;
            }, render: drawGrapeGuy }));
          this.step++;
        }
        if (this.step >= 4 && this.actT > T(2.5)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'shatter':
        if (this.actT > 1.2) { this.spirit = true; this.sx = this.x; this.sy = this.y - 280; this.setAct('float'); this.attackT = 1.5; }
        break;
      case 'float': {
        // Swirling wine spirit drifts around the top of the stage.
        const tx = 640 + Math.sin(this.t * 0.7) * 430, ty = 190 + Math.sin(this.t * 1.3) * 60;
        this.sx += (tx - this.sx) * dt * 1.5; this.sy += (ty - this.sy) * dt * 1.5;
        this.spinT += dt;
        this.attackT -= dt;
        if (this.attackT <= 0) { this.chooseAct(['shards', 'dive', 'rain']); }
        break;
      }
      case 'shards':
        if (this.step < 3 && this.actT > T(0.4) + this.step * T(0.6)) {
          const n = 10, off = this.step * 0.3;
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * Math.PI * 2;
            w.eBullets.push(new Proj({ x: this.sx, y: this.sy, vx: Math.cos(a) * 300 * s, vy: Math.sin(a) * 300 * s, r: 14, parry: i === (this.step * 3) % n, life: 5, render: drawShard }));
          }
          play('glass_shatter', { rate: 1.5, volume: 0.4 });
          this.step++;
        }
        this.drift(dt);
        if (this.step >= 3 && this.actT > T(2.2)) { this.attackT = 1.0 / s; this.setAct('float'); }
        break;
      case 'dive':
        if (this.step === 0) { this.tx = tgt.x; this.ty = tgt.y - 60; this.step = 1; play('super_ghost', { volume: 0.4, rate: 1.4 }); }
        if (this.actT < T(0.6)) { this.sx += Math.sin(this.actT * 60) * 2; }
        else if (this.step === 1) {
          const a = Math.atan2(this.ty - this.sy, this.tx - this.sx);
          this.sx += Math.cos(a) * 1100 * s * dt; this.sy += Math.sin(a) * 1100 * s * dt;
          if (Math.hypot(this.tx - this.sx, this.ty - this.sy) < 40 || this.sy > GROUND - 100) { this.step = 2; G.shake = 8; w.puff(this.sx, this.sy, 80, '#a0284a'); }
        } else {
          this.sy += (200 - this.sy) * dt * 2.5;
          if (this.sy < 240) { this.attackT = 0.8 / s; this.setAct('float'); }
        }
        break;
      case 'rain':
        if (this.actT < T(2.4) && Math.random() < 12 * dt * s) {
          w.eBullets.push(new Proj({ x: rand(40, W - 40), y: -30, vy: rand(380, 520) * s, r: 13, parry: Math.random() < 0.12, life: 4, render: drawWineDrop }));
        }
        this.drift(dt);
        if (this.actT > T(2.8)) { this.attackT = 1.0 / s; this.setAct('float'); }
        break;
    }
  }
  drift(dt) { const tx = 640 + Math.sin(this.t * 0.7) * 430; this.sx += (tx - this.sx) * dt; }
  deathUpdate(dt, w) { super.deathUpdate(dt, w); if (this.spirit) this.sy += 40 * dt; }

  draw(ctx, w) {
    if (this.spirit) return this.drawSpirit(ctx);
    ctx.save();
    const shake = this.dying ? Math.sin(this.t * 80) * 5 : this.hitT > 0 ? 2 : 0;
    if (this.rise > 0) { ctx.beginPath(); ctx.rect(0, -1000, W, 1000 + GROUND); ctx.clip(); }
    ctx.translate(this.x + shake, this.y + (this.rise || 0) * (this.rise || 0) * 520);
    const sway = Math.sin(this.t * 2) * 0.03 + (this.act === 'shatter' ? Math.sin(this.t * 60) * 0.03 : 0);
    ctx.rotate(sway);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 110, 16, 0, 0, 7); ctx.fill();
    // Dress-like bottle base
    const body = [[-95, -10], [-95, -250], [-60, -320], [-36, -350], [-36, -440], [36, -440], [36, -350], [60, -320], [95, -250], [95, -10]];
    ctx.beginPath();
    ctx.moveTo(-95, 0); ctx.lineTo(-95, -240); ctx.bezierCurveTo(-95, -300, -36, -320, -36, -360); ctx.lineTo(-36, -450);
    ctx.lineTo(36, -450); ctx.lineTo(36, -360); ctx.bezierCurveTo(36, -320, 95, -300, 95, -240); ctx.lineTo(95, 0); ctx.closePath();
    ctx.fillStyle = '#2f5a2c'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#6e1430'; ctx.fillRect(-100, -290 + Math.sin(this.t * 3) * 4, 200, 300);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(-70, -440, 22, 440);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-60, -430, 8, 300);
    ctx.restore();
    shadePath(ctx, -10, -250, 280, 1.2);
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    // Foil + cork / hat
    if (this.corked) roundRect(ctx, -30, -490, 60, 46, 8, '#c08a4a', 4);
    else { for (let i = 0; i < 4; i++) circle(ctx, rand(-20, 20), -470 - i * 18, 8, '#e0a0c0', 2); }
    roundRect(ctx, -40, -450, 80, 30, 6, '#8a1a2a', 4);
    // Feathered hat
    ctx.save(); ctx.translate(-10, this.corked ? -485 : -455); ctx.rotate(-0.25);
    ellipse(ctx, 0, 0, 70, 14, '#3b1830', 4);
    roundRect(ctx, -34, -40, 68, 40, 14, '#3b1830', 4);
    ctx.beginPath(); ctx.moveTo(20, -36); ctx.quadraticCurveTo(80, -110, 120, -60); ctx.quadraticCurveTo(80, -70, 30, -20);
    ctx.fillStyle = '#ff9ccc'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
    // Label face
    roundRect(ctx, -82, -250, 164, 150, 16, '#f3e6c4', 4);
    ctx.strokeStyle = '#a8862a'; ctx.lineWidth = 3; ctx.strokeRect(-72, -240, 144, 130);
    const blink = this.hitT > 0.03 || this.act === 'aria' && Math.floor(this.t * 3) % 2;
    // Lashes
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    for (const ex of [-40, 20]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(ex - 10 + i * 10, -214); ctx.lineTo(ex - 14 + i * 12, -228); ctx.stroke(); }
    pieEye(ctx, -40, -195, 16, 20, Math.PI, blink);
    pieEye(ctx, 20, -195, 16, 20, Math.PI, blink);
    circle(ctx, -62, -160, 10, '#ff9ca8', 0); circle(ctx, 44, -160, 10, '#ff9ca8', 0);
    // Singing mouth
    const open = this.sing;
    ellipse(ctx, -10, -140, 18, 6 + open * 16, '#8a1020', 3.5);
    ctx.fillStyle = '#d02040'; ctx.beginPath(); ctx.ellipse(-10, -146 - open * 2, 18, 5, 0, Math.PI, 0); ctx.fill();
    // Grape pearl necklace
    for (let i = 0; i < 9; i++) circle(ctx, -70 + i * 17, -88 + Math.sin(i / 8 * Math.PI) * 18, 9, '#7b2d8e', 2.5);
    // Arms with a fan
    const fan = this.act === 'grapes' ? Math.sin(this.actT * 10) : Math.sin(this.t * 3);
    hose(ctx, -90, -230, -150, -230, -150 - fan * 15, -300, 9, '#f3d6c0');
    glove(ctx, -150 - fan * 15, -305, 12);
    if (this.act === 'grapes') drawBunch(ctx, { x: -150 - fan * 15, y: -330, t: 0 });
    hose(ctx, 90, -230, 140, -200, 130, -150, 9, '#f3d6c0');
    ctx.save(); ctx.translate(130, -150); ctx.rotate(-0.8 + Math.sin(this.t * 6) * 0.3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 60, -Math.PI * 0.9, -Math.PI * 0.1); ctx.closePath();
    ctx.fillStyle = '#ff5fa8'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    for (let i = 1; i < 6; i++) { const a = -Math.PI * 0.9 + i * (Math.PI * 0.8 / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); ctx.stroke(); }
    ctx.restore();
    glove(ctx, 130, -150, 12);
    if (this.act === 'highnote' && this.actT < 0.8) text(ctx, '♪!', -60, -540, 60, '#ff5fa8', 'center', FONT_TITLE, 6);
    ctx.restore();
  }

  drawSpirit(ctx) {
    ctx.save();
    const shake = this.dying ? Math.sin(this.t * 80) * 5 : 0;
    ctx.translate(this.sx + shake, this.sy);
    // Wine swirl
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.rotate(this.t * (2 + i) * (i % 2 ? -1 : 1));
      ctx.beginPath(); ctx.ellipse(0, 0, 100 - i * 20, 70 - i * 14, 0, 0, 7);
      ctx.fillStyle = ['#5a0c24', '#8a1a3a', '#b02a50'][i]; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
    }
    // Trailing tail
    ctx.beginPath(); ctx.moveTo(-50, 40); ctx.quadraticCurveTo(-10, 160 + Math.sin(this.t * 6) * 20, 30, 120); ctx.quadraticCurveTo(10, 80, 50, 40);
    ctx.fillStyle = '#8a1a3a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    // Angry face
    pieEye(ctx, -28, -10, 15, 20, Math.atan2(1, -1), this.hitT > 0.03);
    pieEye(ctx, 26, -10, 15, 20, Math.atan2(1, -1), this.hitT > 0.03);
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-48, -40); ctx.lineTo(-10, -28); ctx.moveTo(48, -40); ctx.lineTo(10, -28); ctx.stroke();
    ellipse(ctx, 0, 34, 24, 12 + Math.sin(this.t * 10) * 5, '#2a0010', 3);
    // Her hat survives the shattering
    ctx.save(); ctx.translate(0, -70); ctx.rotate(-0.25 + Math.sin(this.t * 3) * 0.1);
    ellipse(ctx, 0, 0, 70, 14, '#3b1830', 4);
    roundRect(ctx, -34, -40, 68, 40, 14, '#3b1830', 4);
    ctx.beginPath(); ctx.moveTo(20, -36); ctx.quadraticCurveTo(80, -110, 120, -60); ctx.quadraticCurveTo(80, -70, 30, -20);
    ctx.fillStyle = '#ff9ccc'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }
}

function ringWave(w, cx, cy, gapY, speed) {
  const gapA = Math.atan2(gapY - cy, -600); // angle on the left side where the safe gap sits
  const gapHalf = 0.17;
  w.eBullets.push(new Proj({
    x: cx, y: cy, r: 0, life: 3.2, persist: true, killOffscreen: false, gapA, speed,
    tick: (dt, w, b) => { b.R = b.t * b.speed + 60; },
    hits(r) {
      const px = r.x + r.w / 2, py = r.y + r.h / 2;
      const d = Math.hypot(px - this.x, py - this.y);
      if (Math.abs(d - this.R) > 18 + r.h / 2.6) return false;
      let a = Math.atan2(py - this.y, px - this.x);
      let diff = a - this.gapA; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      const gap = gapHalf * (500 / Math.max(300, this.R));
      return Math.abs(diff) > gap + 0.02;
    },
    render(ctx, b) {
      if (!b.R) return;
      const gap = gapHalf * (500 / Math.max(300, b.R));
      ctx.save();
      ctx.lineCap = 'round';
      for (const [lw, c] of [[22, INK], [14, '#ffd0e4'], [5, '#fff']]) {
        ctx.strokeStyle = c; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.R, b.gapA + gap, b.gapA + Math.PI * 2 - gap); ctx.stroke();
      }
      ctx.restore();
    },
  }));
}

function burstGrapes(w, x) {
  play('splash', { rate: 1.6, volume: 0.4 });
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.35;
    w.eBullets.push(new Proj({ x, y: GROUND - 20, vx: Math.cos(a) * 420, vy: Math.sin(a) * 700, grav: 1600, r: 12, parry: i === 2, life: 3, render: (ctx, b) => b.parry ? drawPinkOrb(ctx, b.x, b.y, b.r) : (circle(ctx, b.x, b.y, b.r, '#7b2d8e', 2.5), circle(ctx, b.x - 3, b.y - 4, 3, '#d9a6ff', 0)) }));
  }
}

function drawNote(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.sin(b.t * 6) * 0.3);
  const col = b.parry ? PINK : '#fff3d0';
  ellipse(ctx, 0, 6, 14, 10, col, 3, -0.4);
  ctx.fillStyle = INK; ctx.fillRect(10, -28, 5, 34);
  ctx.beginPath(); ctx.moveTo(15, -28); ctx.quadraticCurveTo(30, -18, 22, -6); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}
function drawBunch(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 6);
  const pts = [[0, 0], [-14, -12], [14, -12], [-24, -26], [0, -26], [24, -26], [-10, 12], [10, 12], [0, 24]];
  for (const [x, y] of pts) circle(ctx, x, y, 11, '#7b2d8e', 2.5);
  ctx.fillStyle = '#4c7a2a'; ctx.beginPath(); ctx.ellipse(6, -40, 16, 8, 0.4, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}
function drawCork(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y - 25); ctx.rotate((e.ang || -1.57) + Math.PI / 2);
  roundRect(ctx, -16, -24, 32, 48, 8, e.parry ? PINK : '#c08a4a', 3);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 5; i++) ctx.fillRect(-10 + (i * 7) % 20, -16 + i * 7, 3, 3);
  if (e.t > 0.8) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-10, 24); ctx.lineTo(0, 44 + Math.random() * 14); ctx.lineTo(10, 24); ctx.fill(); }
  ctx.restore();
  pieEye(ctx, e.x - 6, e.y - 30, 4, 6, 0); pieEye(ctx, e.x + 6, e.y - 30, 4, 6, 0);
}
function drawGrapeGuy(ctx, e) {
  const sq = e.vy < 0 ? 1.1 : 0.95;
  ctx.save(); ctx.translate(e.x, e.y); ctx.scale(1 / sq, sq);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-12, 0); ctx.moveTo(8, -10); ctx.lineTo(12, 0); ctx.stroke();
  circle(ctx, 0, -26, 20, '#7b2d8e', 3);
  pieEye(ctx, -7, -30, 5, 7, Math.PI); pieEye(ctx, 6, -30, 5, 7, Math.PI);
  ctx.strokeStyle = '#4c7a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -46); ctx.lineTo(4, -56); ctx.stroke();
  ctx.restore();
}
function drawShard(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
  poly(ctx, [[-14, -8], [16, 0], [-14, 8], [-6, 0]], b.parry ? PINK : '#9fd18f', 3);
  ctx.restore();
}
function drawWineDrop(ctx, b) {
  if (b.parry) return drawPinkOrb(ctx, b.x, b.y, b.r);
  ctx.beginPath(); ctx.moveTo(b.x, b.y - b.r * 1.8); ctx.quadraticCurveTo(b.x + b.r * 1.2, b.y, b.x, b.y + b.r);
  ctx.quadraticCurveTo(b.x - b.r * 1.2, b.y, b.x, b.y - b.r * 1.8);
  ctx.fillStyle = '#8a1a3a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
}

// ---- Arena: the Merlot Opera House ----
let bg = null;
function buildBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2a0a14'; ctx.fillRect(0, 0, W, H);
  // Balcony boxes
  for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    const x = 40 + i * 210, y = 60 + row * 150;
    ctx.fillStyle = '#4a1020'; ctx.fillRect(x, y, 170, 110);
    ctx.fillStyle = '#1a0408'; ctx.beginPath(); ctx.moveTo(x + 15, y + 110); ctx.lineTo(x + 15, y + 40); ctx.arc(x + 85, y + 40, 70, Math.PI, 0); ctx.lineTo(x + 155, y + 110); ctx.fill();
    ctx.fillStyle = '#c9a03a'; ctx.fillRect(x, y + 95, 170, 15);
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(x, y, 170, 110);
    // Little audience heads with opera glasses
    for (let k = 0; k < 3; k++) { ctx.fillStyle = '#0d0204'; ctx.beginPath(); ctx.arc(x + 45 + k * 40, y + 85, 15, 0, 7); ctx.fill(); }
  }
  // Stage curtains
  for (const side of [0, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = side ? W - 30 - i * 28 : i * 28;
      ctx.fillStyle = i % 2 ? '#7a0c1a' : '#9a1424';
      ctx.fillRect(x - 14, 0, 30, H);
    }
  }
  ctx.fillStyle = '#9a1424'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 40);
  for (let x = W; x >= 0; x -= 128) ctx.quadraticCurveTo(x - 64, 110, x - 128, 40);
  ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.stroke();
  ctx.fillStyle = '#c9a03a'; for (let x = 64; x < W; x += 128) { ctx.beginPath(); ctx.arc(x, 82, 10, 0, 7); ctx.fill(); ctx.stroke(); }
  // Stage floor
  ctx.fillStyle = '#7a4a20'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#9a6030'; ctx.fillRect(0, GROUND, W, 12);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
  for (let x = 40; x < W; x += 120) { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(x, GROUND + 50, 14, Math.PI, 0); ctx.fill(); ctx.stroke(); }
  return paintify(c);
}

export const merlotLevel = {
  id: 'merlot', type: 'boss', name: 'Madame Merlot', subtitle: 'The Vintage Diva', music: 'boss_merlot', par: 130,
  introSub: '"Darling, you\'re about to hear my final aria!"',
  taunt: 'Such a pity, darling. You simply don\'t age well.',
  setup(w) {
    w.boss = new Merlot(w);
    w.def.phaseMarks = w.diff === 0 ? [0.34] : [0.34, 0.67];
    w.platforms.push({ x: 110, y: 470, w: 200 }, { x: 430, y: 380, w: 200 }, { x: 760, y: 470, w: 160 });
  },
  drawBg(ctx, w) {
    if (!bg) bg = buildBg();
    ctx.drawImage(bg, 0, 0);
    // Spotlight on the diva
    const b = w.boss;
    const sx = b && b.spirit ? b.sx : 1060;
    const g = ctx.createRadialGradient(sx, GROUND - 200, 30, sx, GROUND - 200, 380);
    g.addColorStop(0, 'rgba(255,240,180,.35)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  },
  drawPlatform(ctx, p) {
    // Ornate floating opera boxes hanging from ropes
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x + 20, 0); ctx.lineTo(p.x + 20, p.y); ctx.moveTo(p.x + p.w - 20, 0); ctx.lineTo(p.x + p.w - 20, p.y); ctx.stroke();
    roundRect(ctx, p.x, p.y, p.w, 26, 6, '#c9a03a', 4);
    roundRect(ctx, p.x + 10, p.y + 26, p.w - 20, 18, 6, '#7a0c1a', 3);
  },
};
