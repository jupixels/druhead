import { paintify } from '../fx.js';
// Final boss: Barnaby "Big Tab" Tapsworth, owner of the Last Call Saloon.
import { G, W, H, INK, PINK, GROUND, clamp, rand, pick } from '../core.js';
import { ellipse, circle, poly, hose, pieEye, glove, roundRect, text, starburst, mouth, FONT_TITLE, FONT_UI, sbox, blob } from '../draw.js';
import { Boss } from './base.js';
import { Proj, Enemy, drawPinkOrb, drawCherry } from '../entities.js';
import { play } from '../audio.js';
import { nav } from '../scenes/nav.js';

export class Tab extends Boss {
  constructor(w) {
    super(w, { hp: 2700, phases: [0.75, 0.5, 0.25], name: 'Big Tab' });
    this.x = 1080; this.y = GROUND;
    this.setAct('idle'); this.idleFor = 1.2;
    this.reg = 0; this.giant = false; this.grow = 0; this.mouthOpen = 0;
    this.chandT = 3;
  }
  bodyRect() { return this.giant ? { x: 860, y: 80, w: 420, h: 560 } : { x: this.x - 120, y: this.y - 440, w: 240, h: 430 }; }
  hitboxes() {
    if (this.dying) return [];
    const r = this.bodyRect();
    if (this.giant) return [{ x: 900, y: 140, w: 360, h: 460 }];
    return [{ x: r.x + 20, y: r.y + 40, w: r.w - 40, h: r.h - 40 }];
  }
  hurtboxes() {
    if (this.dying) return [];
    if (this.giant) return [{ x: 950, y: 200, w: 330, h: 440 }];
    const r = this.bodyRect(); return [{ x: r.x + 50, y: r.y + 80, w: r.w - 80, h: r.h - 80 }];
  }
  onPhase(p, w) {
    const msgs = ['', 'DEBT COLLECTORS!', 'DOUBLE OR NOTHING!', 'THE TAB IS DUE!'];
    w.popText(640, 190, msgs[p], ['', '#ffb347', '#ff9ccc', '#ff4a3d'][p], 48);
    play('roar'); play('bell');
    if (p === 3) { this.setAct('grow'); G.shake = 16; }
    else { this.setAct('idle'); this.idleFor = 0.6; }
  }
  introUpdate(dt, w) { this.t += dt; this.reg = Math.sin(this.t * 8) > 0.6 ? 1 : this.reg; if (this.t > 0.6 && !this.laughed) { this.laughed = true; play('roar', { rate: 1.3, volume: 0.6 }); } }

  update(dt, w) {
    this.tickPhases(w);
    this.t += dt; this.actT += dt; this.hitT = Math.max(0, this.hitT - dt);
    const s = this.spd * (1 + this.phase * 0.06);
    const T = (v) => v / s;
    const tgt = w.nearestPlayer(this.x, this.y);
    this.reg = Math.max(0, this.reg - dt * 2);
    this.mouthOpen = Math.max(0, this.mouthOpen - dt * 2);
    switch (this.act) {
      case 'idle': {
        if (this.giant) { this.setAct('gidle'); break; }
        const lists = [['mugs', 'tabs', 'coins'], ['mugs', 'ledger', 'bouncers', 'coins'], ['dice', 'cards', 'ledger', 'tabs']];
        if (this.actT > T(this.idleFor)) this.chooseAct(lists[Math.min(2, this.phase)]);
        break;
      }
      case 'mugs':
        // Slides beer mugs along the floor. Jump them!
        if (this.step < 4 && this.actT > T(0.4) + this.step * T(0.5)) {
          const pink = this.step === 2;
          w.eBullets.push(new Proj({ x: this.x - 130, y: GROUND - 26, vx: -(560 + this.step * 40) * s, r: 26, parry: pink, life: 4,
            rect: function () { return { x: this.x - 22, y: GROUND - 54, w: 44, h: 54 }; }, render: drawMug }));
          play('whoosh', { rate: 1.3, volume: 0.5 }); this.step++;
        }
        if (this.step >= 4 && this.actT > T(2.4)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'tabs':
        // Bar tabs flutter down in zig-zags.
        if (this.step < 6 && this.actT > T(0.3) + this.step * T(0.3)) {
          const x0 = clamp(tgt.x + rand(-300, 300), 40, 900);
          w.eBullets.push(new Proj({ x: x0, y: -30, vy: 170 * s, r: 18, parry: this.step === 4, life: 6, x0, tick: (dt, w, b) => { b.x = b.x0 + Math.sin(b.t * 3) * 70; }, render: drawReceipt }));
          this.step++;
        }
        if (this.step >= 6 && this.actT > T(2.6)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'coins':
        // The cash-register belly sprays coins.
        this.reg = 1;
        if (this.actT > T(0.6) && this.step < 16 && this.actT > T(0.6) + this.step * T(0.08)) {
          w.eBullets.push(new Proj({ x: this.x - 40, y: this.y - 180, vx: -rand(250, 750) * s, vy: -rand(500, 1000), grav: 1500, r: 13, parry: this.step === 9, life: 3, render: drawBossCoin }));
          if (this.step % 3 === 0) play('coin', { vary: 0.2, volume: 0.5 });
          this.step++;
        }
        if (this.step >= 16 && this.actT > T(2.4)) { this.idleFor = 0.6; this.setAct('idle'); }
        break;
      case 'ledger':
        // A giant ledger book slams down on the player.
        if (this.step === 0) { this.lx = clamp(tgt.x, 100, 900); this.step = 1; }
        if (this.step === 1 && this.actT > T(0.9)) {
          this.step = 2; const lx = this.lx;
          w.eBullets.push(new Proj({ x: lx, y: -200, vy: 2200, r: 0, life: 2.5, persist: true, lx,
            rect: function () { return { x: this.x - 110, y: this.y - 40, w: 220, h: 80 }; },
            tick: (dt, w, b) => { if (b.y >= GROUND - 40) { b.y = GROUND - 40; b.vy = 0; if (!b.landed) { b.landed = true; G.shake = 14; play('slam'); w.puff(b.x - 100, GROUND, 40); w.puff(b.x + 100, GROUND, 40); b.harmless = true; } } },
            render: drawLedger }));
        }
        if (this.actT > T(2.0)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'bouncers':
        if (this.step < 2 && this.actT > T(0.3) + this.step * T(1.2)) {
          const e = new Enemy({ x: W + 50, y: GROUND, w: 70, h: 130, hp: 24, vx: -170 * s, coin: false,
            tick: (dt, w, e) => { e.x += e.vx * dt; e.punch = (e.punch || 0) - dt; const p = w.nearestPlayer(e.x, e.y); if (Math.abs(p.x - e.x) < 160 && e.punch <= 0) { e.punch = 1.4; e.vx = -Math.sign(e.x - p.x) * 170 * s; w.eBullets.push(new Proj({ x: e.x - 60 * Math.sign(e.x - p.x), y: GROUND - 70, vx: -Math.sign(e.x - p.x) * 600, r: 24, life: 0.35, color: '#d63a2a' })); play('whoosh'); } if (e.x < -80) e.dead = true; },
            render: drawBouncer });
          w.enemies.push(e); this.step++;
        }
        if (this.step >= 2 && this.actT > T(3.0)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'dice':
        // Two giant dice bounce across the floor.
        if (this.step < 2 && this.actT > T(0.5) + this.step * T(0.8)) {
          w.eBullets.push(new Proj({ x: this.x - 150, y: GROUND - 200, vx: -340 * s, vy: -300, grav: 2000, r: 50, life: 6, persist: true, killOffscreen: false, rot: 0, bounces: 0,
            rect: function () { return { x: this.x - 46, y: this.y - 46, w: 92, h: 92 }; },
            tick: (dt, w, b) => { b.rot += dt * 6; if (b.y > GROUND - 50) { b.y = GROUND - 50; b.vy = -(b.bounces++ % 2 ? 1150 : 700); play('slam', { volume: 0.35, rate: 1.3 }); } if (b.x < -80) b.dead = true; },
            render: drawDie }));
          play('whoosh', { rate: 0.7 }); this.step++;
        }
        if (this.step >= 2 && this.actT > T(3.6)) { this.idleFor = 0.4; this.setAct('idle'); }
        break;
      case 'cards':
        if (this.step < 3 && this.actT > T(0.5) + this.step * T(0.55)) {
          const ox = this.x - 120, oy = this.y - 300, a = Math.atan2(tgt.y - 50 - oy, tgt.x - ox);
          for (let i = -2; i <= 2; i++) w.eBullets.push(new Proj({ x: ox, y: oy, vx: Math.cos(a + i * 0.13) * 520 * s, vy: Math.sin(a + i * 0.13) * 520 * s, r: 14, parry: this.step === 2 && i === 0, life: 4, suit: pick(['♠', '♥', '♦', '♣']), render: drawCard }));
          play('whoosh', { rate: 1.6, volume: 0.5 }); this.step++;
        }
        if (this.step >= 3 && this.actT > T(2.0)) { this.idleFor = 0.5; this.setAct('idle'); }
        break;
      case 'grow':
        this.grow = Math.min(1, this.actT / 1.6);
        if (this.actT > 1.8) { this.giant = true; this.setAct('gidle'); }
        break;
      case 'gidle':
        this.chandT -= dt;
        if (this.chandT <= 0) { this.chandT = rand(2.6, 3.6) / s; chandelier(w, clamp(tgt.x, 80, 820)); }
        if (this.actT > T(0.9)) this.chooseAct(['spiral', 'gmugs', 'rain']);
        break;
      case 'spiral':
        // Dollar signs spiral out of the cash-drawer mouth.
        this.mouthOpen = 1;
        if (this.actT < T(2.4) && Math.floor(this.actT * 16) !== Math.floor((this.actT - dt) * 16)) {
          const k = this.actT * 16;
          for (const off of [0, Math.PI]) {
            const a = Math.PI + Math.sin(k * 0.35 + off) * 1.1;
            w.eBullets.push(new Proj({ x: 960, y: 440, vx: Math.cos(a) * 330 * s, vy: Math.sin(a) * 330 * s, r: 15, parry: Math.floor(k) % 11 === 0 && off === 0, life: 5, render: drawDollar }));
          }
        }
        if (this.actT > T(3.0)) this.setAct('gidle');
        break;
      case 'gmugs':
        if (this.step < 3 && this.actT > T(0.3) + this.step * T(0.6)) {
          w.eBullets.push(new Proj({ x: 880, y: GROUND - 26, vx: -650 * s, r: 26, parry: this.step === 1, life: 4, rect: function () { return { x: this.x - 22, y: GROUND - 54, w: 44, h: 54 }; }, render: drawMug }));
          this.step++;
        }
        if (this.step >= 3 && this.actT > T(2.2)) this.setAct('gidle');
        break;
      case 'rain':
        if (this.actT < T(2.2) && Math.random() < 10 * dt * s) w.eBullets.push(new Proj({ x: rand(30, 860), y: -30, vy: rand(420, 560) * s, r: 14, parry: Math.random() < 0.12, life: 3, render: drawBossCoin }));
        if (this.actT > T(2.8)) this.setAct('gidle');
        break;
    }
  }

  draw(ctx, w) {
    const sh = this.dying ? Math.sin(this.t * 80) * 6 : this.hitT > 0 ? 2 : 0;
    if (this.giant) return this.drawGiant(ctx, sh);
    ctx.save(); ctx.translate(this.x + sh, this.y);
    const sc = 1 + this.grow * 0.3; ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, 0, 130, 18, 0, 0, 7); ctx.fill();
    // Legs
    hose(ctx, -40, -60, -46, -30, -50, -8, 18, '#3a2a4a'); hose(ctx, 40, -60, 46, -30, 50, -8, 18, '#3a2a4a');
    for (const x of [-50, 50]) ellipse(ctx, x - 10, -8, 26, 12, '#111', 3);
    // Big round body in a striped waistcoat
    blob(ctx, 0, -200, 125, 160, '#7a1c1c', 5, 1.3);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -200, 125, 160, 0, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(255,220,150,.3)'; ctx.lineWidth = 6; for (let x = -120; x < 130; x += 30) { ctx.beginPath(); ctx.moveTo(x, -360); ctx.lineTo(x, -40); ctx.stroke(); }
    ctx.restore();
    // Cash register belly
    roundRect(ctx, -70, -230, 140, 110, 10, '#c9a03a', 4);
    roundRect(ctx, -56, -218, 112, 34, 4, '#f3e6c4', 3);
    text(ctx, this.reg > 0.5 ? '$$$' : 'NO SALE', 0, -200, 20, '#7a1c1c', 'center', FONT_UI, 0);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) circle(ctx, -40 + c * 26, -165 + r * 22, 8, '#fff', 2);
    roundRect(ctx, -60, -120 + this.reg * 30, 120, 26, 4, '#a8802a', 4);
    // Gold watch chain
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-100, -150); ctx.quadraticCurveTo(-80, -100, -60, -130); ctx.stroke();
    // Head (a big jug)
    sbox(ctx, -70, -440, 140, 110, 40, '#c9762a', 5, 1.2);
    ellipse(ctx, 70, -390, 24, 30, null, 6);
    pieEye(ctx, -36, -405, 15, 19, Math.PI, this.hitT > 0.03);
    pieEye(ctx, 12, -405, 15, 19, Math.PI, this.hitT > 0.03);
    ctx.strokeStyle = INK; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-58, -432); ctx.lineTo(-20, -422); ctx.moveTo(34, -432); ctx.lineTo(0, -422); ctx.stroke();
    // Grin with gold tooth + mutton chops
    ctx.beginPath(); ctx.moveTo(-50, -370); ctx.quadraticCurveTo(-12, -330, 30, -370); ctx.closePath(); ctx.fillStyle = '#3a0a0a'; ctx.fill(); ctx.lineWidth = 3.5; ctx.stroke();
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(-20, -370, 12, 10); ctx.fillStyle = '#fff'; ctx.fillRect(-36, -370, 14, 8); ctx.fillRect(-6, -370, 14, 8);
    for (const x of [-72, 72]) ellipse(ctx, x, -360, 16, 30, '#6b4220', 3);
    // Top hat
    roundRect(ctx, -90, -456, 180, 22, 8, '#1b1b22', 4);
    roundRect(ctx, -60, -560, 120, 110, 8, '#1b1b22', 4);
    ctx.fillStyle = '#7a1c1c'; ctx.fillRect(-60, -480, 120, 20);
    roundRect(ctx, 20, -540, 34, 46, 4, '#f3e6c4', 2.5); text(ctx, 'IOU', 37, -517, 13, '#7a1c1c', 'center', FONT_UI, 0);
    // Arms (one holds a swizzle-stick cane)
    const sw = Math.sin(this.t * 3) * 10;
    hose(ctx, -110, -260, -170, -250, -170, -200 + sw, 16, '#7a1c1c'); glove(ctx, -170, -200 + sw, 18);
    hose(ctx, 110, -260, 170, -240, 160, -170, 16, '#7a1c1c'); glove(ctx, 160, -170, 18);
    ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(160, -170); ctx.lineTo(180, 0); ctx.stroke();
    ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 5; ctx.stroke();
    if (this.act === 'ledger' && this.step === 1) { const k = this.actT; ctx.restore(); ctx.fillStyle = `rgba(0,0,0,${0.2 + k * 0.3})`; ctx.beginPath(); ctx.ellipse(this.lx, GROUND, 120, 14, 0, 0, 7); ctx.fill(); return; }
    ctx.restore();
  }
  drawGiant(ctx, sh) {
    ctx.save(); ctx.translate(sh, 0);
    // Huge face rising from behind the bar
    sbox(ctx, 880, 120, 420, 560, 120, '#c9762a', 6, 1.3);
    roundRect(ctx, 840, 70, 500, 60, 14, '#1b1b22', 6);
    roundRect(ctx, 930, -120, 320, 200, 12, '#1b1b22', 6);
    ctx.fillStyle = '#7a1c1c'; ctx.fillRect(930, 30, 320, 34);
    pieEye(ctx, 990, 260, 40, 52, Math.PI + 0.3, this.hitT > 0.03);
    pieEye(ctx, 1110, 260, 40, 52, Math.PI + 0.3, this.hitT > 0.03);
    ctx.strokeStyle = INK; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(930, 190); ctx.lineTo(1030, 220); ctx.moveTo(1170, 190); ctx.lineTo(1070, 220); ctx.stroke();
    // Cash-drawer mouth
    const o = 30 + this.mouthOpen * 60 + Math.sin(this.t * 6) * 6;
    roundRect(ctx, 920, 400, 260, o, 10, '#3a0a0a', 6);
    ctx.fillStyle = '#ffd84a'; ctx.fillRect(1000, 400, 30, 22);
    roundRect(ctx, 910, 400 + o, 280, 40, 8, '#c9a03a', 5);
    text(ctx, 'LAST CALL', 1050, 420 + o, 22, '#7a1c1c', 'center', FONT_TITLE, 0);
    for (const x of [870, 1230]) ellipse(ctx, x + 10, 420, 40, 90, '#6b4220', 5);
    ctx.restore();
    // The bar counter in front of him
    roundRect(ctx, 840, GROUND - 120, 460, 140, 6, '#6b3a1a', 5);
    roundRect(ctx, 820, GROUND - 136, 500, 26, 6, '#9a6030', 5);
  }
}

function chandelier(w, x) {
  w.eBullets.push(new Proj({ x, y: -80, vy: 0, r: 0, life: 4, wait: 0.9, persist: true, killOffscreen: false,
    rect: function () { return this.t < this.wait ? { x: 0, y: -999, w: 0, h: 0 } : { x: this.x - 70, y: this.y - 30, w: 140, h: 60 }; },
    tick: (dt, w, b) => { if (b.t >= b.wait && !b.landed) { b.vy += 2400 * dt; } if (b.y > GROUND - 30 && !b.landed) { b.landed = true; b.vy = 0; b.y = GROUND - 30; G.shake = 10; play('glass_shatter'); w.debris(b.x, GROUND - 40, '#ffe39a', 8, 12); b.life = 0.25; } },
    render(ctx, b) {
      if (b.t < b.wait) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(b.x, GROUND, 70, 12, 0, 0, 7); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 3; if (!b.landed) { ctx.beginPath(); ctx.moveTo(b.x, b.y - 200); ctx.lineTo(b.x, b.y - 20); ctx.stroke(); }
      ellipse(ctx, b.x, b.y, 70, 20, '#d9a93a', 4);
      for (let i = -2; i <= 2; i++) { roundRect(ctx, b.x + i * 26 - 4, b.y - 30, 8, 20, 2, '#f3e6c4', 2); circle(ctx, b.x + i * 26, b.y - 34, 5, '#ffe680', 0); }
    } }));
}
function drawMug(ctx, b) {
  ctx.save(); ctx.translate(b.x, GROUND);
  roundRect(ctx, -22, -54, 40, 54, 6, b.parry ? '#ffc0dc' : 'rgba(220,240,255,.95)', 3.5);
  ctx.fillStyle = b.parry ? PINK : '#e8a634'; ctx.fillRect(-19, -42, 34, 39);
  for (let i = 0; i < 3; i++) circle(ctx, -14 + i * 13, -54, 9, '#fffbea', 2.5);
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(22, -28, 12, -1.2, 1.2); ctx.stroke();
  ctx.restore();
}
function drawReceipt(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.sin(b.t * 3) * 0.5);
  roundRect(ctx, -14, -20, 28, 40, 2, b.parry ? PINK : '#f3e6c4', 2.5);
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-8, -12 + i * 8); ctx.lineTo(8, -12 + i * 8); ctx.stroke(); }
  ctx.restore();
}
function drawBossCoin(ctx, b) {
  if (b.parry) return drawPinkOrb(ctx, b.x, b.y, b.r);
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(0.4 + Math.abs(Math.cos(b.t * 8)) * 0.6, 1);
  circle(ctx, 0, 0, b.r, '#ffd84a', 3); circle(ctx, 0, 0, b.r * 0.55, '#ffec9a', 2);
  ctx.restore();
}
function drawLedger(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.globalAlpha = b.landed ? Math.min(1, b.life * 2) : 1;
  roundRect(ctx, -110, -40, 220, 80, 8, '#5a1a1a', 5);
  roundRect(ctx, -100, -34, 200, 12, 3, '#f3e6c4', 2);
  text(ctx, 'LEDGER', 0, 10, 28, '#ffd84a', 'center', FONT_TITLE, 0);
  ctx.restore();
}
function drawBouncer(ctx, e) {
  ctx.save(); ctx.translate(e.x, e.y);
  ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(-16, 0); ctx.moveTo(14, -30); ctx.lineTo(16, 0); ctx.stroke();
  roundRect(ctx, -36, -130, 72, 104, 18, '#2a2a2a', 4);
  roundRect(ctx, -20, -160, 40, 36, 8, '#2a2a2a', 4);
  ctx.fillStyle = '#111'; ctx.fillRect(-22, -150, 44, 10);
  roundRect(ctx, -28, -96, 56, 30, 4, '#f3e6c4', 2.5); text(ctx, 'SECURITY', 0, -81, 10, '#7a1c1c', 'center', FONT_UI, 0);
  const pu = e.punch > 1.1 ? -40 : 0;
  ellipse(ctx, -46 + pu, -80, 18, 16, '#d63a2a', 3);
  ctx.restore();
}
function drawDie(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
  roundRect(ctx, -46, -46, 92, 92, 14, '#f3e6c4', 5);
  for (const [x, y] of [[-22, -22], [22, 22], [0, 0], [22, -22], [-22, 22]]) circle(ctx, x, y, 8, '#c0392b', 0);
  ctx.restore();
}
function drawCard(ctx, b) {
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 12);
  roundRect(ctx, -12, -17, 24, 34, 3, b.parry ? PINK : '#fff', 2.5);
  text(ctx, b.suit, 0, 1, 16, b.suit === '♥' || b.suit === '♦' ? '#c0392b' : INK, 'center', FONT_UI, 0);
  ctx.restore();
}
function drawDollar(ctx, b) {
  if (b.parry) return drawPinkOrb(ctx, b.x, b.y, b.r);
  circle(ctx, b.x, b.y, b.r, '#8dd14f', 3);
  text(ctx, '$', b.x, b.y + 1, 20, '#2f5e2c', 'center', FONT_TITLE, 0);
}

let bg = null;
function buildBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a1a0a'); g.addColorStop(1, '#6b3a1a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Wallpaper
  ctx.fillStyle = 'rgba(255,220,150,.06)'; for (let x = 0; x < W; x += 50) for (let y = 0; y < GROUND; y += 50) { ctx.beginPath(); ctx.arc(x + ((y / 50) % 2) * 25, y, 8, 0, 7); ctx.fill(); }
  // Wanted posters of the bosses he collected from
  const names = ['HOPS', 'MERLOT', 'AGAVE', 'RUMBEARD', 'MIXER'];
  names.forEach((n, i) => { const x = 60 + i * 150, y = 120 + (i % 2) * 30; roundRect(ctx, x, y, 110, 140, 4, '#e8d29a', 3); ctx.font = `16px ${FONT_TITLE}`; ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.fillText('PAID', x + 55, y + 30); ctx.fillText(n, x + 55, y + 120); ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x + 10, y + 130); ctx.lineTo(x + 100, y + 10); ctx.stroke(); });
  // Piano
  roundRect(ctx, 20, GROUND - 160, 220, 160, 6, '#2a1a10', 4);
  ctx.fillStyle = '#f3e6c4'; ctx.fillRect(30, GROUND - 100, 200, 22);
  ctx.fillStyle = INK; for (let x = 40; x < 230; x += 16) ctx.fillRect(x, GROUND - 100, 6, 13);
  // Floor
  ctx.fillStyle = '#5a3218'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 2; for (let x = 0; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x - 30, H); ctx.stroke(); }
  return paintify(c);
}

export const tabLevel = {
  id: 'tab', type: 'boss', name: 'Big Tab Tapsworth', subtitle: 'Owner of the Last Call Saloon', music: 'boss_tab', par: 200,
  introSub: '"Well, well. Time to settle your tab, boys... permanently!"',
  taunt: 'The house always wins, pal. Put it on your tab!',
  setup(w) {
    w.boss = new Tab(w);
    w.def.phaseMarks = w.diff === 0 ? [0.25, 0.5] : [0.25, 0.5, 0.75];
    w.platforms.push({ x: 300, y: 495, w: 130 }, { x: 560, y: 400, w: 130 });
  },
  drawBg(ctx) { if (!bg) bg = buildBg(); ctx.drawImage(bg, 0, 0); },
  drawPlatform(ctx, p) {
    // Barstools
    ctx.fillStyle = INK; ctx.fillRect(p.x + p.w / 2 - 5, p.y + 20, 10, GROUND - p.y - 20);
    ellipse(ctx, p.x + p.w / 2, p.y + 10, p.w / 2, 16, '#7a1c1c', 4);
    ellipse(ctx, p.x + p.w / 2, GROUND - 4, 40, 8, '#444', 3);
  },
  after: (d) => (d >= 1 ? nav.ending() : nav.map()),
};
