// Boss 1: Sir Hops-a-Lot, a boxing beer keg.
import { G, W, H, INK, GROUND, clamp, rand, pick, wob } from '../core.js';
import { ellipse, circle, poly, hose, pieEye, glove, shoe, roundRect, text, starburst, mouth, FONT_TITLE } from '../draw.js';
import { Boss } from './base.js';
import { Proj, Enemy, drawPinkOrb } from '../entities.js';
import { play } from '../audio.js';

const HOME = 1050;

export class Hops extends Boss {
  constructor(w) {
    super(w, { hp: 1500, phases: [0.66, 0.33], name: 'Sir Hops-a-Lot' });
    this.x = HOME; this.y = GROUND; this.vx = 0; this.vy = 0;
    this.glove = 0;      // haymaker extension 0..1
    this.punchY = 0;
    this.rolling = false; this.rot = 0;
    this.squash = 1;
    this.red = 0;
    this.setAct('idle');
    this.idleFor = 1.2;
    this.dripT = 0; this.geyserT = 3;
  }

  bodyRect() {
    if (this.rolling) return { x: this.x - 115, y: this.y - 115, w: 230, h: 230 };
    return { x: this.x - 115, y: this.y - 300, w: 230, h: 290 };
  }
  hitboxes() {
    if (this.dying) return [];
    const r = this.bodyRect();
    return [{ x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.h - 20 }];
  }
  hurtboxes() {
    if (this.dying) return [];
    const out = [];
    const r = this.bodyRect();
    out.push({ x: r.x + 30, y: r.y + 30, w: r.w - 60, h: r.h - 30 });
    if (this.glove > 0.05) {
      const gx = this.gloveX();
      out.push({ x: gx - 38, y: this.punchY - 34, w: 76, h: 68 });
    }
    return out;
  }
  gloveX() { return this.x - 120 - this.glove * (this.x - 220); }

  onPhase(p, w) {
    if (p === 1) {
      w.popText(this.x - 60, 220, 'SECOND ROUND!', '#ffb347', 44);
      play('roar'); play('bell');
      this.setAct('chug');
    }
    if (p === 2) {
      w.popText(this.x - 60, 220, 'LAST ROUND!', '#ff6a3d', 50);
      play('glass_shatter'); play('roar');
      this.setAct('crack');
      w.debris(this.x, this.y - 200, '#9b5a2a', 12, 22);
    }
  }

  introUpdate(dt) { this.t += dt; this.squash = 1 + Math.sin(this.t * 10) * 0.03; }

  update(dt, w) {
    this.t += dt; this.actT += dt; this.hitT = Math.max(0, this.hitT - dt);
    const s = this.spd * (this.phase >= 1 ? 1.15 : 1);
    const T = (v) => v / s;
    const tgt = w.nearestPlayer(this.x, this.y);
    this.squash += (1 - this.squash) * Math.min(1, dt * 10);
    this.red = Math.max(this.red, this.phase >= 1 ? 1 : 0);

    switch (this.act) {
      case 'idle':
        this.glove = Math.max(0, this.glove - dt * 4);
        this.squash = 1 + Math.sin(this.t * 9) * 0.04;
        if (this.rolling) { this.setAct('roll'); break; }
        if (Math.abs(this.x - HOME) > 5) { this.x += Math.sign(HOME - this.x) * Math.min(Math.abs(HOME - this.x), 500 * dt); }
        if (this.actT > T(this.idleFor)) {
          const list = this.phase === 0 ? ['haymaker', 'bubbles', 'slam'] : ['haymaker', 'pretzels', 'caps', 'slam'];
          this.chooseAct(list);
        }
        break;

      case 'haymaker': {
        // Wind up, then spring-punch high or low.
        if (this.step === 0) { this.high = Math.random() < 0.5; this.punchY = this.high ? GROUND - 110 : GROUND - 36; this.step = 1; }
        if (this.actT < T(0.75)) { this.glove = -0.06 * Math.sin(this.actT * 40); if (this.actT < 0.02) play('whoosh', { rate: 0.7 }); }
        else if (this.actT < T(0.75) + 0.22) { this.glove = Math.min(1, this.glove + dt * 5.5); if (this.step === 1) { play('whoosh'); this.step = 2; } }
        else if (this.actT < T(0.75) + 0.6) { this.glove = 1; if (this.step === 2) { G.shake = 6; play('slam', { volume: 0.5, rate: 1.3 }); this.step = 3; } }
        else { this.glove = Math.max(0, this.glove - dt * 3); if (this.glove <= 0) { this.idleFor = 0.7; this.setAct(this.phase >= 1 && Math.random() < 0.4 ? 'haymaker2' : 'idle'); } }
        break;
      }
      case 'haymaker2': this.setAct('haymaker'); this.lastAct = 'haymaker'; break;

      case 'bubbles':
        if (this.actT > T(0.4) + this.step * T(0.42) && this.step < 5) {
          const pink = this.step === 2;
          const y0 = this.y - 170;
          const amp = rand(40, 90), base = y0 + rand(-30, 60);
          w.eBullets.push(new Proj({
            x: this.x - 140, y: y0, vx: -270 * s, r: 22, parry: pink, life: 9,
            tick: (dt, w, b) => { b.y = base + Math.sin(b.t * 3) * amp; },
            render: drawBubble,
          }));
          play('burp', { vary: 0.2, volume: 0.5 });
          this.squash = 1.1; this.step++;
        }
        if (this.step >= 5 && this.actT > T(2.6)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;

      case 'slam':
        if (this.step === 0) { this.squash = 0.8; if (this.actT > T(0.45)) { this.step = 1; this.vy = -1700; play('whoosh', { rate: 0.6 }); } }
        else if (this.step === 1) { this.vy += 2600 * dt; this.y += this.vy * dt; if (this.y < -400) { this.step = 2; this.aim = clamp(tgt.x, 200, 1080); this.shadowT = 0; } }
        else if (this.step === 2) { this.x = this.aim; this.shadowT += dt; if (this.shadowT > T(0.65)) { this.step = 3; this.vy = 2400; } }
        else if (this.step === 3) {
          this.y += this.vy * dt;
          if (this.y >= GROUND) {
            this.y = GROUND; this.squash = 0.65; this.step = 4; this.actT = 0;
            G.shake = 18; play('slam');
            w.puff(this.x - 100, GROUND, 60); w.puff(this.x + 100, GROUND, 60);
            for (const d of [-1, 1]) w.eBullets.push(new Proj({ x: this.x + d * 120, y: GROUND - 24, vx: d * 520 * s, r: 26, life: 4, rect: function () { return { x: this.x - 22, y: GROUND - 46, w: 44, h: 46 }; }, render: drawWave }));
            if (this.phase >= 1) for (let i = 0; i < 5; i++) w.eBullets.push(new Proj({ x: this.x + rand(-80, 80), y: GROUND - 260, vx: rand(-420, 420), vy: rand(-900, -500), grav: 1500, r: 16, life: 4, render: drawDrop }));
          }
        } else if (this.actT > T(0.6)) { this.idleFor = 0.8; this.setAct('idle'); }
        break;

      case 'chug':
        this.glove = 0;
        if (this.actT > 1.4) { this.idleFor = 0.3; this.setAct('idle'); }
        break;

      case 'pretzels':
        if (this.actT > T(0.45) + this.step * T(0.55) && this.step < 2) {
          const hi = this.step === 0 ? GROUND - 60 : GROUND - 210;
          const sx = this.x - 130, sy = this.y - 200;
          w.eBullets.push(new Proj({
            x: sx, y: sy, r: 26, life: 4.5, persist: true, parry: this.step === 1 && Math.random() < 0.5,
            tick: (dt, w, b) => { const k = b.t / 3.2; b.x = sx - Math.sin(k * Math.PI) * 950; b.y = sy + (hi - sy) * Math.sin(Math.min(1, k * 2) * Math.PI / 2) - Math.sin(k * Math.PI * 2) * 30; b.vx = 0; b.vy = 0; if (k > 1) b.dead = true; },
            render: drawPretzel,
          }));
          play('whoosh', { vary: 0.2 });
          this.squash = 1.08; this.step++;
        }
        if (this.step >= 2 && this.actT > T(3.6)) { this.idleFor = 0.4; this.setAct('idle'); }
        break;

      case 'caps':
        if (this.actT > T(0.4) + this.step * T(0.7) && this.step < 3) {
          const pink = this.step === 1;
          w.enemies.push(new Enemy({ x: this.x - 140, y: GROUND, w: 54, h: 54, hp: 7, vx: -400 * s, parry: pink, spin: 0,
            tick: (dt, w, e) => { e.x += e.vx * dt; e.spin += dt * 12; if (e.x < -100) e.dead = true; },
            render: drawCap, onParry: (w, p) => { /* bounce off it */ } }));
          play('cork_pop', { rate: 0.7 });
          this.step++;
        }
        if (this.step >= 3 && this.actT > T(2.4)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;

      case 'crack':
        this.glove = 0;
        if (this.actT > 1.2) { this.rolling = true; this.vx = -460 * this.spd; this.vy = -600; this.y = GROUND - 115; this.setAct('roll'); }
        break;

      case 'roll': {
        this.vy += 1500 * dt;
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.rot += (this.vx / 115) * dt;
        if (this.y > GROUND - 115) { this.y = GROUND - 115; this.vy = -rand(800, 1100) * Math.min(1.1, this.spd); G.shake = 8; play('slam', { volume: 0.45, rate: 1.2 }); w.puff(this.x, GROUND, 40); }
        if (this.x < 135) { this.x = 135; this.vx = Math.abs(this.vx); }
        if (this.x > W - 135) { this.x = W - 135; this.vx = -Math.abs(this.vx); }
        // Leaking foam drops
        this.dripT -= dt;
        if (this.dripT <= 0) {
          this.dripT = rand(0.35, 0.6) / this.spd;
          w.eBullets.push(new Proj({ x: this.x + rand(-60, 60), y: this.y, vx: rand(-200, 200), vy: -rand(300, 700), grav: 1400, r: 15, life: 3, parry: Math.random() < 0.15, render: drawDrop }));
        }
        // Foam geysers
        this.geyserT -= dt;
        if (this.geyserT <= 0) {
          this.geyserT = rand(2.2, 3.2) / this.spd;
          const gx = clamp(tgt.x + rand(-40, 40), 60, W - 60);
          spawnGeyser(w, gx);
        }
        break;
      }
    }
  }

  deathUpdate(dt, w) {
    super.deathUpdate(dt, w);
    this.glove = Math.max(0, this.glove - dt * 3);
    if (this.rolling) { this.vy += 1500 * dt; this.y += this.vy * dt; if (this.y > GROUND - 115) { this.y = GROUND - 115; this.vy = 0; } this.rot += Math.sin(this.deathT * 20) * dt; }
    else if (this.y < GROUND) { this.y = Math.min(GROUND, this.y + 1500 * dt); }
  }

  draw(ctx, w) {
    // Slam shadow
    if (this.act === 'slam' && this.step === 2) {
      const k = Math.min(1, this.shadowT / 0.65);
      ctx.fillStyle = `rgba(0,0,0,${0.2 + k * 0.3})`; ctx.beginPath(); ctx.ellipse(this.aim, GROUND, 60 + k * 70, 14, 0, 0, 7); ctx.fill();
      return;
    }
    if (this.y < -300) return;
    ctx.save();
    const shake = this.dying ? Math.sin(this.t * 80) * 5 : this.hitT > 0 ? 2 : 0;
    ctx.translate(this.x + shake, this.y);
    if (this.rolling) { this.drawRolling(ctx); ctx.restore(); return; }
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 130, 16, 0, 0, 7); ctx.fill();
    ctx.scale(1 / Math.sqrt(this.squash), this.squash);
    const bob = Math.sin(this.t * 9) * 3;
    // Legs
    hose(ctx, -45, -30, -50, -15, -60, -6, 10, INK);
    hose(ctx, 45, -30, 50, -15, 60, -6, 10, INK);
    shoe(ctx, -60, 0, -1, '#4a2410', 1.6); shoe(ctx, 60, 0, -1, '#4a2410', 1.6);
    // Back arm + glove
    const gb = this.act === 'chug' ? -40 : 0;
    hose(ctx, 105, -170, 150, -140, 140, -110 + gb + bob, 12, '#f2d0a0');
    if (this.act === 'chug') this.drawMug(ctx, 130, -230 + Math.sin(this.actT * 12) * 6);
    else drawBoxGlove(ctx, 140, -110 + bob, 1);
    // Barrel
    this.drawBarrel(ctx, 0, -160, this.phase >= 1);
    // Face
    const ang = this.act === 'haymaker' || this.act === 'slam';
    pieEye(ctx, -70, -215, 20, 28, Math.PI, this.hitT > 0.03);
    pieEye(ctx, -10, -215, 20, 28, Math.PI, this.hitT > 0.03);
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-95, ang ? -258 : -252); ctx.lineTo(-50, ang ? -244 : -252); ctx.moveTo(-30, ang ? -244 : -252); ctx.lineTo(15, ang ? -258 : -252); ctx.stroke();
    // Spigot nose
    roundRect(ctx, -150, -186, 70, 22, 8, '#d9a93a', 3.5);
    roundRect(ctx, -158, -192, 18, 34, 5, '#d9a93a', 3.5);
    roundRect(ctx, -118, -205, 12, 20, 3, '#b8892a', 3);
    if (this.act === 'bubbles' || this.act === 'chug') { circle(ctx, -162, -175 + (this.t * 60) % 20, 6, '#fff6d0', 2); }
    // Mustache
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(-40, -150);
    ctx.bezierCurveTo(-60, -120, -120, -125, -130, -150); ctx.bezierCurveTo(-110, -138, -80, -140, -40, -150);
    ctx.bezierCurveTo(-20, -120, 30, -125, 40, -150); ctx.bezierCurveTo(20, -140, -10, -140, -40, -150); ctx.fill();
    // Mouth
    const open = this.act === 'bubbles' ? 0.9 : this.act === 'chug' ? 0.2 : 0.4;
    ctx.beginPath(); ctx.moveTo(-85, -118); ctx.quadraticCurveTo(-40, -118 + 60 * open, 5, -118); ctx.closePath();
    ctx.fillStyle = '#5a1010'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(-70, -118, 50, 7);
    // Foam pompadour
    for (let i = 0; i < 7; i++) circle(ctx, -95 + i * 30, -312 - Math.sin(i * 1.7) * 10 + wob(i, 1), 26 - Math.abs(i - 3) * 2, '#fffbea', 3);
    circle(ctx, -110, -330, 22, '#fffbea', 3);
    // Front arm / haymaker
    if (this.glove > 0.05) {
      const gx = this.gloveX() - this.x;
      const py = this.punchY - this.y;
      ctx.strokeStyle = '#777'; ctx.lineWidth = 6; ctx.beginPath();
      const n = 14; for (let i = 0; i <= n; i++) { const px = -110 + (gx + 110) * (i / n), pyy = -150 + (py + 150) * (i / n) + (i % 2 ? -14 : 14); i ? ctx.lineTo(px, pyy) : ctx.moveTo(px, pyy); }
      ctx.stroke(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
      drawBoxGlove(ctx, gx, py, -1, 1.25);
    } else {
      const wind = this.act === 'haymaker' && this.actT < 0.75 / this.spd;
      const gx = wind ? -60 + Math.sin(this.t * 40) * 4 : -140, gy = wind ? (this.high ? -170 : -60) : -100 + bob;
      hose(ctx, -100, -150, -140, -130, gx, gy, 12, '#f2d0a0');
      drawBoxGlove(ctx, gx, gy, -1);
      if (wind) text(ctx, '!', -40, -380, 60, '#ff5030', 'center', FONT_TITLE, 6);
    }
    ctx.restore();
  }

  drawBarrel(ctx, cx, cy, cracked) {
    const w = 125, h = 160;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.85, cy - h);
    ctx.bezierCurveTo(cx - w * 1.12, cy - h * 0.4, cx - w * 1.12, cy + h * 0.4, cx - w * 0.85, cy + h);
    ctx.lineTo(cx + w * 0.85, cy + h);
    ctx.bezierCurveTo(cx + w * 1.12, cy + h * 0.4, cx + w * 1.12, cy - h * 0.4, cx + w * 0.85, cy - h);
    ctx.closePath();
    ctx.fillStyle = this.red ? '#b8582c' : '#b06a32'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(60,30,10,.5)'; ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 34, cy - h); ctx.quadraticCurveTo(cx + i * 44, cy, cx + i * 34, cy + h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,220,170,.25)'; ctx.fillRect(cx - 80, cy - h, 30, h * 2);
    for (const hy of [-h + 30, h - 40]) { ctx.fillStyle = '#555'; ctx.fillRect(cx - 200, cy + hy, 400, 20); ctx.fillStyle = '#888'; ctx.fillRect(cx - 200, cy + hy + 3, 400, 4); }
    ctx.restore();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    for (const hy of [-h + 30, h - 40]) { ctx.beginPath(); ctx.moveTo(cx - w, cy + hy); ctx.lineTo(cx + w, cy + hy); ctx.moveTo(cx - w, cy + hy + 20); ctx.lineTo(cx + w, cy + hy + 20); ctx.lineWidth = 3; ctx.stroke(); }
    if (cracked) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(cx + 60, cy - 100); ctx.lineTo(cx + 40, cy - 60); ctx.lineTo(cx + 70, cy - 30); ctx.lineTo(cx + 50, cy + 10); ctx.stroke();
    }
  }

  drawMug(ctx, x, y) {
    roundRect(ctx, x - 25, y - 30, 50, 60, 6, 'rgba(220,240,255,.9)', 3);
    ctx.fillStyle = '#e8a634'; ctx.fillRect(x - 22, y - 18, 44, 46);
    for (let i = 0; i < 4; i++) circle(ctx, x - 18 + i * 12, y - 30, 10, '#fffbea', 2.5);
  }

  drawRolling(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, GROUND - this.y, 110, 14, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.rotate(this.rot);
    circle(ctx, 0, 0, 115, '#b8582c', 5);
    ctx.strokeStyle = 'rgba(60,30,10,.5)'; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(110, 0); ctx.stroke(); }
    ctx.strokeStyle = '#555'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, 85, 0, 7); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 92, 0, 7); ctx.arc(0, 0, 78, 0, 7); ctx.stroke();
    ctx.restore();
    // Face stays upright, dizzy
    pieEye(ctx, -35, -20, 16, 22, this.t * 10, false);
    pieEye(ctx, 15, -20, 16, 22, -this.t * 10, false);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-10, 30, 26, 14, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 3; i++) starburst(ctx, Math.cos(this.t * 5 + i * 2) * 70, -100 + Math.sin(this.t * 5 + i * 2) * 15, 12, 5, '#ffe14a', 0, 2);
    // Foam spurting from the crack
    for (let i = 0; i < 3; i++) circle(ctx, Math.cos(this.rot) * 110 + i * 8, Math.sin(this.rot) * 110 - i * 10, 12 - i * 2, '#fffbea', 2);
  }
}

function spawnGeyser(w, gx) {
  // Bubbling telegraph, then a column of foam.
  w.eBullets.push(new Proj({
    x: gx, y: GROUND, r: 40, life: 2.0, harmless: true, persist: true,
    tick: (dt, w, b) => {
      if (b.t > 0.9 && !b.fired) {
        b.fired = true; b.harmless = false; play('splash');
        G.shake = Math.max(G.shake, 5);
      }
    },
    rect: function () { return this.fired ? { x: this.x - 34, y: GROUND - 420 * Math.min(1, (this.t - 0.9) * 6), w: 68, h: 420 } : { x: 0, y: -999, w: 0, h: 0 }; },
    render: (ctx, b) => {
      if (!b.fired) {
        for (let i = 0; i < 4; i++) circle(ctx, b.x + Math.sin(b.t * 20 + i * 2) * 26, GROUND - 6 - ((b.t * 60 + i * 9) % 30), 7, '#fffbea', 2);
        return;
      }
      const k = Math.min(1, (b.t - 0.9) * 6);
      const hgt = 420 * k * (b.life < 0.3 ? b.life / 0.3 : 1);
      ctx.fillStyle = '#ffe39a'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(b.x - 30, GROUND);
      for (let y = 0; y <= hgt; y += 30) ctx.lineTo(b.x - 30 + Math.sin(y * 0.05 + b.t * 20) * 6, GROUND - y);
      ctx.lineTo(b.x + 30, GROUND - hgt); ctx.lineTo(b.x + 30, GROUND); ctx.fill(); ctx.stroke();
      for (let i = 0; i < 5; i++) circle(ctx, b.x - 30 + i * 15, GROUND - hgt + Math.sin(i + b.t * 10) * 5, 16, '#fffbea', 3);
    },
  }));
}

export function drawBoxGlove(ctx, x, y, dir, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ellipse(ctx, 0, 0, 40, 34, '#d63a2a', 4);
  ellipse(ctx, 18, -14, 16, 13, '#d63a2a', 3.5);
  ellipse(ctx, -12, -12, 12, 7, 'rgba(255,255,255,.45)', 0);
  roundRect(ctx, -52, -18, 18, 36, 5, '#fff', 3);
  ctx.restore();
}
function drawBubble(ctx, b) {
  if (b.parry) { drawPinkOrb(ctx, b.x, b.y, b.r); return; }
  circle(ctx, b.x, b.y, b.r, 'rgba(255,245,210,.9)', 3);
  circle(ctx, b.x - 7, b.y - 7, 6, '#fff', 0);
  circle(ctx, b.x + 8, b.y + 5, 4, 'rgba(230,190,90,.7)', 0);
}
function drawWave(ctx, b) {
  ctx.save(); ctx.translate(b.x, GROUND); ctx.scale(Math.sign(b.vx), 1);
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.quadraticCurveTo(-20, -60, 20, -48); ctx.quadraticCurveTo(0, -30, 30, 0); ctx.closePath();
  ctx.fillStyle = '#fffbea'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
  circle(ctx, 10, -44, 8, '#fffbea', 2.5);
  ctx.restore();
}
function drawDrop(ctx, b) {
  if (b.parry) { drawPinkOrb(ctx, b.x, b.y, b.r); return; }
  ctx.beginPath(); ctx.moveTo(b.x, b.y - b.r * 1.6); ctx.quadraticCurveTo(b.x + b.r * 1.2, b.y + b.r * 0.2, b.x, b.y + b.r);
  ctx.quadraticCurveTo(b.x - b.r * 1.2, b.y + b.r * 0.2, b.x, b.y - b.r * 1.6);
  ctx.fillStyle = '#ffd86a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
}
function drawPretzel(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 10);
  const col = b.parry ? '#ff5fa8' : '#a8602a';
  ctx.lineCap = 'round';
  for (const [lw, c] of [[16, INK], [10, col]]) {
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath();
    ctx.moveTo(-18, 18); ctx.bezierCurveTo(-40, -10, -20, -30, 0, -8); ctx.bezierCurveTo(20, -30, 40, -10, 18, 18);
    ctx.moveTo(-18, 18); ctx.lineTo(10, -4); ctx.moveTo(18, 18); ctx.lineTo(-10, -4); ctx.stroke();
  }
  ctx.restore();
}
function drawCap(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y - 27); ctx.rotate(-e.spin);
  starburst(ctx, 0, 0, 28, 12, e.parry ? '#ff5fa8' : '#c9c9c9', 0, 3);
  circle(ctx, 0, 0, 20, e.parry ? '#ff9ccc' : '#d63a2a', 3);
  ctx.restore();
  pieEye(ctx, e.x - 8, e.y - 32, 5, 7, Math.PI); pieEye(ctx, e.x + 6, e.y - 32, 5, 7, Math.PI);
}

// ---- Arena ----
let bgCache = null;
function buildBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  // Wall
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5a3218'); g.addColorStop(1, '#8a5428');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(30,15,5,.35)'; ctx.lineWidth = 3;
  for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x + (x % 3) * 3, 0); ctx.lineTo(x, GROUND); ctx.stroke(); }
  // Arched windows
  for (const wx of [180, 640, 1100]) {
    ctx.fillStyle = '#e9c77a'; ctx.beginPath(); ctx.moveTo(wx - 70, 300); ctx.lineTo(wx - 70, 170); ctx.arc(wx, 170, 70, Math.PI, 0); ctx.lineTo(wx + 70, 300); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wx, 100); ctx.lineTo(wx, 300); ctx.moveTo(wx - 70, 210); ctx.lineTo(wx + 70, 210); ctx.stroke();
  }
  // Sign
  roundRect(ctx, W / 2 - 170, 30, 340, 64, 10, '#2e1a0c', 5);
  ctx.font = `40px ${FONT_TITLE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffd86a'; ctx.fillText('HOPS HALL', W / 2, 64);
  // Barrel stacks
  const barrel = (x, y, r) => { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.95, 0, 0, 7); ctx.fillStyle = '#7a4420'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 0.66, 0, 0, 7); ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#c99a3a'; ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fill(); ctx.stroke(); };
  for (let i = 0; i < 3; i++) barrel(60 + i * 90, GROUND - 50, 48);
  for (let i = 0; i < 2; i++) barrel(105 + i * 90, GROUND - 140, 48);
  // Floor
  ctx.fillStyle = '#6b3a1a'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = '#8a4e24'; ctx.fillRect(0, GROUND, W, 14);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,10,0,.4)';
  for (let x = 0; x < W; x += 110) { ctx.beginPath(); ctx.moveTo(x, GROUND + 14); ctx.lineTo(x - 40, H); ctx.stroke(); }
  return c;
}

export const hopsLevel = {
  id: 'hops', type: 'boss', name: 'Sir Hops-a-Lot', subtitle: 'The Brawling Keg', music: 'boss_hops', par: 110,
  introSub: '"Put \'em up! Nobody leaves my ring sober!"',
  taunt: 'Ha! You punch like a light beer!',
  phaseMarks: [0.34, 0.67],
  setup(w) { w.boss = new Hops(w); w.def.phaseMarks = w.diff === 0 ? [0.34] : [0.34, 0.67]; },
  drawBg(ctx, w) {
    if (!bgCache) bgCache = buildBg();
    ctx.drawImage(bgCache, 0, 0);
    // String lights
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 110); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 110 + Math.sin(x / 160 * Math.PI) * 30); ctx.stroke();
    for (let x = 20; x < W; x += 80) circle(ctx, x, 120 + Math.sin(x / 160 * Math.PI) * 30, 7, Math.floor(G.time * 3 + x) % 2 ? '#ffe680' : '#ffb347', 2);
  },
  drawFg(ctx, w) {
    // Crowd silhouettes raising mugs
    for (let i = 0; i < 14; i++) {
      const x = i * 98 + 20, b = Math.abs(Math.sin(G.time * 6 + i)) * 8;
      ctx.fillStyle = '#1b120a';
      ctx.beginPath(); ctx.ellipse(x, H + 30 - b, 46, 50, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x, H - 28 - b, 22, 0, 7); ctx.fill();
      if (i % 3 === 0) {
        const mx = x + 34, my = H - 48 - b * 2;
        ctx.fillRect(mx - 4, my + 10, 8, 40);
        roundRect(ctx, mx - 13, my - 18, 26, 30, 4, '#c98a2c', 2.5);
        for (let k = 0; k < 3; k++) circle(ctx, mx - 9 + k * 9, my - 18, 7, '#fffbea', 2);
      }
    }
  },
};
