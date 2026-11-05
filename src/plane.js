// Flying stage controller: a little biplane piloted by Shotty or Pint.
import { G, W, H, INK, PINK, clamp, rand } from './core.js';
import { ellipse, circle, poly, roundRect, starburst } from './draw.js';
import { Player } from './player.js';
import { play } from './audio.js';

class PBullet {
  constructor(o) { Object.assign(this, { vx: 0, vy: 0, r: 9, dmg: 3, life: 2, t: 0, dead: false, meter: true, hitMap: new Map(), pierce: false }, o); }
  update(dt, w) {
    this.t += dt;
    if (this.grav) this.vy += this.grav * dt;
    if (this.homing) {
      const tg = w.nearestTarget(this.x, this.y);
      if (tg) { const a = Math.atan2(tg.y - this.y, tg.x - this.x); const sp = Math.hypot(this.vx, this.vy); let c = Math.atan2(this.vy, this.vx); let d = a - c; while (d > Math.PI) d -= 6.283; while (d < -Math.PI) d += 6.283; c += clamp(d, -5 * dt, 5 * dt); this.vx = Math.cos(c) * sp; this.vy = Math.sin(c) * sp; }
    }
    this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
    if (this.life <= 0 || this.x > W + 100 || this.y > H + 100 || this.y < -100) this.dead = true;
  }
  canHit(t) { return !this.pierce || !this.hitMap.has(t); }
  onHit(t, w) {
    if (this.pierce) { this.hitMap.set(t, 1); return; }
    this.dead = true;
    if (this.boom) { w.explode(this.x, this.y, 0.6); play('bomb', { volume: 0.5 }); }
    else w.spark(this.x, this.y, '#fff8d0', 0.5);
  }
  draw(ctx) {
    if (this.kind === 'bomb') { circle(ctx, this.x, this.y, 11, '#333', 3); ctx.fillStyle = '#ffb347'; ctx.fillRect(this.x - 2, this.y - 18, 4, 7); return; }
    if (this.kind === 'torp') { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.vy, this.vx)); roundRect(ctx, -20, -8, 40, 16, 8, '#c9762a', 3); roundRect(ctx, 16, -4, 10, 8, 2, '#d9a93a', 2); ctx.restore(); return; }
    ctx.fillStyle = 'rgba(255,240,180,.4)'; ctx.fillRect(this.x - 28, this.y - 3, 28, 6);
    ellipse(ctx, this.x, this.y, 11, 6, '#ffe39a', 2.5);
  }
}

export class Plane extends Player {
  constructor(idx, x, y, loadout) {
    super(idx, x, y, loadout);
    this.isPlane = true;
    this.maxHp = 3 + (this.trinket === 'opener' ? 1 : 0) + (this.trinket === 'driver' ? 2 : 0);
    this.hp = this.maxHp;
    this.bombs = false;
    this.shrink = false;
    this.spinT = 0; this.parryCd = 0;
    this.prop = 0;
    this.bomberT = 0;
  }
  get weapon() { return { name: this.bombs ? 'Bomb Drop' : 'Peppy Blaster' }; }
  rect() { return this.shrink ? { x: this.x - 18, y: this.y - 12, w: 36, h: 24 } : { x: this.x - 34, y: this.y - 20, w: 68, h: 40 }; }
  computeMuzzle() { this.mx = this.x + 40; this.my = this.y; }
  move() {}
  update(dt, w, inp) {
    if (this.dead) return this.updateGhost(dt, w);
    this.invuln = Math.max(0, this.invuln - dt);
    this.parryFlash = Math.max(0, this.parryFlash - dt);
    this.prop += dt * 40;
    if (this.trinket === 'icebucket') this.addMeter(5 * dt);
    if (this.bomberT > 0) {
      // Super: barrel bomber dive across the screen
      this.bomberT -= dt;
      this.x += 900 * dt; if (this.x > W + 60) this.x = -60;
      this.y += Math.sin(this.bomberT * 6) * 300 * dt;
      for (const t of w.damageTargets()) { const r = t.rect; if (this.x > r.x && this.x < r.x + r.w && this.y > r.y - 40 && this.y < r.y + r.h + 40) w.applyDamage(t, 120 * dt, { owner: this, meter: false }); }
      return;
    }
    this.shrink = inp.held.dash;
    const sp = this.shrink ? 560 : 420;
    const l = Math.hypot(inp.ax, inp.ay) || 1;
    this.vx = (inp.ax / l) * sp; this.vy = (inp.ay / l) * sp;
    this.x = clamp(this.x + this.vx * dt, 40, W - 60);
    this.y = clamp(this.y + this.vy * dt, 40, H - 40);
    // Parry spin
    this.parryCd = Math.max(0, this.parryCd - dt);
    this.parryT = Math.max(0, this.parryT - dt);
    this.spinT = Math.max(0, this.spinT - dt);
    if (inp.pressed.jump && this.parryCd <= 0) { this.parryT = 0.22; this.spinT = 0.3; this.parryCd = 0.45; }
    if (inp.pressed.swap) { this.bombs = !this.bombs; w.popText(this.x, this.y - 50, this.bombs ? 'BOMBS' : 'BLASTER', '#ffe39a', 20); play('menu_move'); }
    this.fireCd -= dt;
    this.computeMuzzle();
    if (inp.held.shoot && this.fireCd <= 0) {
      const dm = this.shrink ? 0.5 : 1;
      if (this.bombs) {
        w.pBullets.push(new PBullet({ x: this.x + 10, y: this.y + 20, vx: 380, vy: -120, grav: 1300, r: 12, dmg: 10 * dm, kind: 'bomb', boom: true, owner: this, life: 3 }));
        this.fireCd = 0.42; play('shoot_champ', { rate: 1.2, volume: 0.5 });
      } else {
        this.alt = -this.alt || 1;
        w.pBullets.push(new PBullet({ x: this.mx, y: this.my + this.alt * 6, vx: 1300, r: 9, dmg: 3.2 * dm, owner: this }));
        this.fireCd = 0.08; play('plane_shoot', { vary: 0.1, cooldown: 0.07 });
      }
    }
    if (inp.pressed.ex) {
      if (this.meter >= 500) { this.meter = 0; this.stats.supers++; this.bomberT = 3; this.invuln = 3.3; w.flash = 0.25; play('super_beam'); }
      else if (this.meter >= 100) {
        this.meter -= 100; this.stats.ex++; play('ex_shot');
        for (const d of [-0.3, 0, 0.3]) w.pBullets.push(new PBullet({ x: this.mx, y: this.my, vx: Math.cos(d) * 700, vy: Math.sin(d) * 700, r: 16, dmg: 12, kind: 'torp', homing: true, boom: true, owner: this, meter: false, life: 3 }));
      }
    }
  }
  tryParry(obj, w) {
    if (this.dead || this.parryT <= 0) return false;
    const r = this.rect();
    const cx = clamp(obj.x, r.x - 24, r.x + r.w + 24), cy = clamp(obj.y, r.y - 24, r.y + r.h + 24);
    if ((cx - obj.x) ** 2 + (cy - obj.y) ** 2 > (obj.r + 8) ** 2) return false;
    this.parryT = 0; this.parryCd = 0; this.parryFlash = 0.25;
    this.addMeter(100); this.stats.parries++; G.hitstop = 0.12; play('parry'); w.parryFx(obj.x, obj.y);
    return true;
  }
  takeHit(w) {
    if (this.dead || this.invuln > 0) return;
    if (this.trinket === 'penny' && !this.pennyUsed) { this.pennyUsed = true; this.invuln = 1.2; w.popText(this.x, this.y - 60, 'LUCKY!', '#ffd84a', 26); return; }
    this.hp--; this.stats.hits++; w.stats.hits++;
    this.invuln = 1.8; G.hitstop = 0.1; G.shake = 10; play('player_hit'); w.hitFx(this.x, this.y);
    if (this.hp <= 0) { this.dead = true; this.ghostY = this.y + 60; this.ghostT = 0; play('player_die'); w.onPlayerDown(this); }
  }
  revive(w) { this.dead = false; this.hp = 1; this.invuln = 2.5; this.y = clamp(this.ghostY + 60, 60, H - 60); play('revive'); }
  draw(ctx) {
    if (this.dead) return this.drawGhost(ctx);
    if (this.invuln > 0 && this.bomberT <= 0 && Math.floor(this.invuln * 20) % 2 === 0) return;
    ctx.save(); ctx.translate(this.x, this.y);
    const s = this.shrink ? 0.55 : 1;
    ctx.scale(s, s);
    if (this.spinT > 0) ctx.rotate((1 - this.spinT / 0.3) * Math.PI * 2);
    ctx.rotate(this.vy / 2400);
    const body = this.idx ? '#6b3f8f' : '#c0392b';
    if (this.bomberT > 0) { circle(ctx, 0, 0, 50, 'rgba(255,200,60,.5)', 0); }
    // Back wing
    roundRect(ctx, -22, -34, 34, 16, 6, '#f3e6c4', 3);
    // Fuselage
    ctx.beginPath(); ctx.moveTo(-46, -4); ctx.quadraticCurveTo(-40, -22, 0, -20); ctx.quadraticCurveTo(40, -18, 44, 0); ctx.quadraticCurveTo(40, 18, 0, 18); ctx.quadraticCurveTo(-40, 16, -46, -4);
    ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    poly(ctx, [[-46, -4], [-60, -24], [-50, -26], [-36, -10]], body, 3);
    // Lower wing
    roundRect(ctx, -24, 6, 44, 14, 6, '#f3e6c4', 3);
    // Propeller
    roundRect(ctx, 42, -6, 10, 12, 3, '#888', 2.5);
    const pl = Math.abs(Math.sin(this.prop)) * 26 + 4;
    ellipse(ctx, 52, 0, 4, pl, 'rgba(240,240,240,.8)', 2);
    ctx.restore();
    // Pilot head
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(s * 0.55, s * 0.55);
    if (this.spinT > 0) ctx.rotate((1 - this.spinT / 0.3) * Math.PI * 2);
    this.drawHead(ctx, -4, -26, 0);
    ctx.restore();
    if (this.parryFlash > 0) circle(ctx, this.x, this.y, 50 * this.parryFlash / 0.25 + 10, 'rgba(255,95,168,.5)', 0);
  }
}
