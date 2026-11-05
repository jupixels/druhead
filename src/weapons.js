// The alcohol shooters, their EX shots, and the Supers.
import { G, INK, rand, clamp } from './core.js';
import { ellipse, circle, poly, roundRect, starburst } from './draw.js';
import { play } from './audio.js';

class Bullet {
  constructor(o) {
    Object.assign(this, { vx: 0, vy: 0, r: 8, dmg: 1, life: 2, pierce: false, dead: false, t: 0, hitEvery: 0, hitMap: new Map(), meter: true, ex: false, rot: 0 }, o);
  }
  update(dt, w) {
    this.t += dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    if (this.x < w.camX - 200 || this.x > w.camX + 1480 || this.y < -300 || this.y > 900) this.dead = true;
  }
  // Return true if this bullet may hit `target` now (for piercing multi-hit).
  canHit(target) {
    if (!this.pierce) return true;
    const last = this.hitMap.get(target);
    return last === undefined || (this.hitEvery > 0 && this.t - last >= this.hitEvery);
  }
  onHit(target, w) {
    if (this.pierce) this.hitMap.set(target, this.t);
    else this.dead = true;
    w.spark(this.x, this.y, this.hitColor || '#fff8d0', this.ex ? 1.4 : 0.6);
  }
  draw() {}
}

// ---------- Beer Blaster ----------
class Foam extends Bullet {
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.vy, this.vx));
    ctx.fillStyle = 'rgba(255,240,180,.35)';
    ctx.beginPath(); ctx.ellipse(-22, 0, 22, 5, 0, 0, 7); ctx.fill();
    ellipse(ctx, 0, 0, 13, 8, '#ffe39a', 2.5);
    circle(ctx, 4, -2, 4, '#fffbe8', 0);
    circle(ctx, -6, 3, 3, '#fff', 0);
    ctx.restore();
  }
}
class Keg extends Bullet {
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.t * 14 * Math.sign(this.vx || 1));
    circle(ctx, 0, 0, this.r, '#9b5a2a', 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.62, 0, 7); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.r, 0); ctx.lineWidth = 2.5; ctx.stroke(); }
    circle(ctx, 0, 0, 6, '#d8c07a', 3);
    ctx.restore();
  }
}

// ---------- Whiskey Scatter ----------
class ShotGlass extends Bullet {
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.vy, this.vx) + Math.PI / 2);
    poly(ctx, [[-8, -9], [8, -9], [5, 9], [-5, 9]], 'rgba(220,240,255,.9)', 2.5);
    poly(ctx, [[-6.5, -3], [6.5, -3], [5, 8], [-5, 8]], '#d08a2c', 0);
    ctx.restore();
  }
}
class Flame extends Bullet {
  update(dt, w) { super.update(dt, w); this.vx *= 0.985; this.vy *= 0.985; }
  draw(ctx) {
    const s = 1 + Math.sin(this.t * 40) * 0.15;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.vy, this.vx));
    ellipse(ctx, 0, 0, 26 * s, 15 * s, '#ff8a1e', 3);
    ellipse(ctx, 4, 0, 14 * s, 8 * s, '#ffe066', 0);
    ctx.restore();
  }
}

// ---------- Wine Seeker ----------
class Grape extends Bullet {
  update(dt, w) {
    const tgt = w.nearestTarget(this.x, this.y);
    if (tgt) {
      const want = Math.atan2(tgt.y - this.y, tgt.x - this.x);
      let cur = Math.atan2(this.vy, this.vx);
      let d = want - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      cur += clamp(d, -7 * dt, 7 * dt);
      const sp = Math.hypot(this.vx, this.vy);
      this.vx = Math.cos(cur) * sp; this.vy = Math.sin(cur) * sp;
    }
    super.update(dt, w);
  }
  draw(ctx) {
    circle(ctx, this.x, this.y, 8, '#7b2d8e', 2.5);
    circle(ctx, this.x - 2, this.y - 3, 2.5, '#d9a6ff', 0);
    ctx.strokeStyle = '#4c7a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(this.x, this.y - 8); ctx.lineTo(this.x + 3, this.y - 13); ctx.stroke();
  }
}
class Corkscrew extends Bullet {
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.vy, this.vx));
    ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) { const px = -30 + i * 2.2, py = Math.sin(i * 0.9 + this.t * 30) * 9; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.strokeStyle = '#c9c9c9'; ctx.lineWidth = 4; ctx.stroke();
    roundRect(ctx, -52, -12, 22, 24, 6, '#c08a4a', 3);
    ctx.restore();
  }
}

// ---------- Champagne Popper ----------
class Bubbly extends Bullet {
  constructor(o) { super(o); this.bounces = 0; }
  update(dt, w) {
    this.vy += 1900 * dt;
    super.update(dt, w);
    if (this.y > w.groundAt(this.x) - 10 && this.vy > 0) {
      if (this.bounces++ >= 1) { this.pop(w); return; }
      this.y = w.groundAt(this.x) - 10; this.vy *= -0.6;
    }
  }
  pop(w) { this.dead = true; w.puff(this.x, this.y, this.big ? 120 : 34, '#fff7d6'); if (this.big) { w.radialDamage(this.x, this.y, 150, this.dmg, this); play('bomb'); } else play('cork_pop', { vary: 0.15, volume: 0.5 }); }
  onHit(t, w) { if (this.big) { this.pop(w); return; } super.onHit(t, w); w.puff(this.x, this.y, 30, '#fff7d6'); play('cork_pop', { vary: 0.15, volume: 0.5 }); }
  draw(ctx) {
    const s = this.big ? 2.2 : 1;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.t * 12); ctx.scale(s, s);
    roundRect(ctx, -6, -14, 12, 24, 5, '#2f5e2c', 2.5);
    roundRect(ctx, -3, -20, 6, 8, 2, '#e6c35a', 2);
    ctx.fillStyle = '#f3e6c4'; ctx.fillRect(-5, -2, 10, 7);
    ctx.restore();
  }
}

// ---------- Tequila Charger ----------
class Lime extends Bullet {
  draw(ctx) {
    const s = this.big ? 2.4 : 1;
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.t * (this.big ? 6 : 20)); ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI); ctx.closePath();
    ctx.fillStyle = '#8fd14f'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI); ctx.closePath(); ctx.fillStyle = '#e6f7a0'; ctx.fill();
    ctx.restore();
    if (this.big) { ctx.fillStyle = 'rgba(200,255,120,.25)'; ctx.beginPath(); ctx.arc(this.x, this.y, 40, 0, 7); ctx.fill(); }
  }
}
class Spike extends Bullet {
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(Math.atan2(this.vy, this.vx));
    poly(ctx, [[-70, -10], [30, -6], [60, 0], [30, 6], [-70, 10]], '#6aa84f', 3);
    poly(ctx, [[-60, -4], [40, 0], [-60, 4]], '#b6e388', 0);
    ctx.restore();
  }
}

// ---------- Vodka Boomerang ----------
class IceCube extends Bullet {
  update(dt, w) {
    // Fly out, curve back.
    this.vx += this.ax * dt; this.vy += this.ay * dt;
    super.update(dt, w);
    this.rot += dt * 10;
  }
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    roundRect(ctx, -11, -11, 22, 22, 5, 'rgba(200,235,255,.92)', 2.5);
    ctx.fillStyle = '#fff'; ctx.fillRect(-6, -7, 5, 4);
    ctx.restore();
  }
}
class FrostWall extends Bullet {
  update(dt, w) {
    super.update(dt, w);
    // Absorb non-parryable enemy bullets.
    for (const e of w.eBullets) {
      if (!e.dead && !e.parry && !e.solid && Math.abs(e.x - this.x) < 40 && Math.abs(e.y - this.y) < 110) { e.dead = true; w.puff(e.x, e.y, 18, '#e0f4ff'); }
    }
  }
  draw(ctx) {
    const a = clamp(this.life * 2, 0, 1);
    ctx.save(); ctx.globalAlpha = a;
    for (let i = 0; i < 5; i++) {
      const y = this.y - 100 + i * 42;
      roundRect(ctx, this.x - 22 + Math.sin(i * 2 + this.t * 3) * 3, y, 44, 40, 8, 'rgba(190,230,255,.85)', 3);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(this.x - 14, y + 6, 8, 6);
    }
    ctx.restore();
  }
}

// ---------- Super: Last Call (beam) ----------
export class Beam extends Bullet {
  constructor(o) { super({ pierce: true, hitEvery: 0.08, life: 1.6, meter: false, ex: true, ...o }); }
  update(dt, w) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) this.dead = true;
    const p = this.owner;
    this.x = p.x + p.facing * 40; this.y = p.y - 50;
    this.len = 1400;
    // Beam damages everything along its line.
    for (const t of w.damageTargets()) {
      const r = t.rect;
      const x0 = this.facing > 0 ? this.x : this.x - this.len, x1 = this.facing > 0 ? this.x + this.len : this.x;
      if (r.x < x1 && r.x + r.w > x0 && r.y < this.y + 45 && r.y + r.h > this.y - 45 && this.canHit(t.ref)) {
        this.hitMap.set(t.ref, this.t);
        w.applyDamage(t, this.dmg, this);
      }
    }
  }
  draw(ctx) {
    const wob = Math.sin(this.t * 60) * 6;
    const f = this.facing, L = this.len * f;
    ctx.save();
    ctx.fillStyle = 'rgba(255,200,60,.5)'; ctx.fillRect(Math.min(this.x, this.x + L), this.y - 48 - wob, this.len, 96 + wob * 2);
    ctx.fillStyle = '#ffe680'; ctx.fillRect(Math.min(this.x, this.x + L), this.y - 30 - wob / 2, this.len, 60 + wob);
    ctx.fillStyle = '#fffbea'; ctx.fillRect(Math.min(this.x, this.x + L), this.y - 12, this.len, 24);
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.strokeRect(Math.min(this.x, this.x + L), this.y - 48 - wob, this.len, 96 + wob * 2);
    for (let i = 0; i < 12; i++) circle(ctx, this.x + f * ((i * 117 + this.t * 900) % this.len), this.y + Math.sin(i * 3) * 30, 6, '#fff', 2);
    ctx.restore();
  }
}
// ---------- Super: Spirit Form (giant ghost bottle swoop) ----------
export class Spirit extends Bullet {
  constructor(o) { super({ pierce: true, hitEvery: 0.12, life: 2.2, r: 120, meter: false, ex: true, ...o }); this.sx = o.x; this.sy = o.y; }
  update(dt, w) {
    this.t += dt; this.life -= dt; if (this.life <= 0) this.dead = true;
    const k = this.t / 2.2;
    this.x = this.sx + this.facing * k * 1300;
    this.y = this.sy - 80 - Math.sin(k * Math.PI) * 160 + Math.sin(this.t * 8) * 20;
    for (const t of w.damageTargets()) {
      const r = t.rect;
      const cx = clamp(this.x, r.x, r.x + r.w), cy = clamp(this.y, r.y, r.y + r.h);
      if ((cx - this.x) ** 2 + (cy - this.y) ** 2 < this.r ** 2 && this.canHit(t.ref)) { this.hitMap.set(t.ref, this.t); w.applyDamage(t, this.dmg, this); }
    }
  }
  draw(ctx) {
    ctx.save(); ctx.globalAlpha = 0.85; ctx.translate(this.x, this.y); ctx.scale(this.facing, 1);
    ctx.beginPath();
    ctx.moveTo(-60, -120); ctx.quadraticCurveTo(-90, 60, -120, 120);
    for (let i = 0; i < 5; i++) ctx.quadraticCurveTo(-100 + i * 50, 90 + (i % 2) * 40, -70 + i * 50, 120);
    ctx.quadraticCurveTo(90, 40, 60, -120); ctx.quadraticCurveTo(0, -170, -60, -120);
    ctx.fillStyle = '#d6f0ff'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    roundRect(ctx, -22, -190, 44, 60, 10, '#d6f0ff', 4);
    ellipse(ctx, -22, -50, 14, 22, INK, 0); ellipse(ctx, 26, -50, 14, 22, INK, 0);
    ellipse(ctx, 4, 10, 30, 22, INK, 0);
    ctx.restore();
  }
}

const D = (deg) => (deg * Math.PI) / 180;
function fire(w, p, B, ang, sp, o) {
  const b = new B({ x: p.mx, y: p.my, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, owner: p, ...o });
  w.pBullets.push(b); return b;
}

export const WEAPONS = {
  beer: {
    name: 'Beer Blaster', desc: 'A steady stream of foam. Reliable from any range.', price: 0, ex: 'Keg Cannon',
    rate: 0.12,
    fire(w, p, a) { p.alt = -p.alt || 1; const b = fire(w, p, Foam, a, 1200, { r: 10, dmg: 4, life: 1.4 }); b.y += p.alt * 5; play('shoot_beer', { vary: 0.08, cooldown: 0.08 }); },
    exFire(w, p, a) { fire(w, p, Keg, a, 720, { r: 34, dmg: 10, pierce: true, hitEvery: 0.14, life: 2.5, ex: true, meter: false }); },
  },
  whiskey: {
    name: 'Whiskey Scatter', desc: 'A fan of shot glasses. Huge damage up close, short range.', price: 4, ex: 'Flaming Shot',
    rate: 0.16,
    fire(w, p, a) { for (const d of [-15, -5, 5, 15]) fire(w, p, ShotGlass, a + D(d + rand(-3, 3)), 1150, { r: 10, dmg: 2.6, life: 0.3 }); play('shoot_whiskey', { vary: 0.1, cooldown: 0.1 }); },
    exFire(w, p, a) { for (const d of [-24, -12, 0, 12, 24]) fire(w, p, Flame, a + D(d), 820, { r: 26, dmg: 7, pierce: true, hitEvery: 0.2, life: 0.6, ex: true, meter: false, hitColor: '#ffb040' }); },
  },
  wine: {
    name: 'Wine Seeker', desc: 'Grapes that home in on foes. Weak, but never misses.', price: 4, ex: 'Corkscrew',
    rate: 0.15,
    fire(w, p, a) { fire(w, p, Grape, a + rand(-0.3, 0.3), 720, { r: 9, dmg: 2.6, life: 2.2, hitColor: '#d9a6ff' }); play('shoot_wine', { vary: 0.12, cooldown: 0.1 }); },
    exFire(w, p, a) { fire(w, p, Corkscrew, a, 900, { r: 26, dmg: 6, pierce: true, hitEvery: 0.1, life: 1.8, ex: true, meter: false }); },
  },
  champ: {
    name: 'Champagne Popper', desc: 'Lobbed bottles that bounce once, then pop. Hits hard, travels low.', price: 4, ex: 'Big Fizz',
    rate: 0.34,
    fire(w, p, a) { const up = a < -1 && a > -2.2; fire(w, p, Bubbly, a, 0, { vx: (up ? 120 : 640) * Math.sign(Math.cos(a) || p.facing), vy: up ? -1100 : -520 + Math.sin(a) * 300, r: 13, dmg: 11, life: 3 }); play('shoot_champ', { vary: 0.1 }); },
    exFire(w, p, a) { fire(w, p, Bubbly, a, 0, { vx: 560 * p.facing, vy: -700, r: 28, dmg: 38, life: 3, big: true, ex: true, meter: false }); },
  },
  tequila: {
    name: 'Tequila Charger', desc: 'Tap for lime seeds. Hold to charge a huge lime blast.', price: 4, ex: 'Agave Spike',
    rate: 0.22, charge: true,
    fire(w, p, a, charged) {
      if (charged) { fire(w, p, Lime, a, 1500, { r: 30, dmg: 36, life: 1.2, big: true, pierce: true, hitEvery: 99 }); play('shoot_tequila'); w.puff(p.mx, p.my, 40, '#e6f7a0'); }
      else { fire(w, p, Lime, a, 1100, { r: 10, dmg: 3, life: 1.2 }); play('shoot_beer', { rate: 1.4, vary: 0.1, volume: 0.6 }); }
    },
    exFire(w, p, a) { fire(w, p, Spike, a, 1500, { r: 30, dmg: 9, pierce: true, hitEvery: 0.06, life: 1.2, ex: true, meter: false }); },
  },
  vodka: {
    name: 'Vodka Boomerang', desc: 'Ice cubes that fly out and come back, hitting twice.', price: 4, ex: 'Frost Wall',
    rate: 0.2,
    fire(w, p, a) {
      const sp = 950, vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      fire(w, p, IceCube, a, sp, { r: 12, dmg: 4.4, life: 1.8, pierce: true, hitEvery: 0.35, ax: -vx * 1.25, ay: -vy * 1.25 + 220 });
      play('shoot_vodka', { vary: 0.1, cooldown: 0.12 });
    },
    exFire(w, p, a) { w.pBullets.push(new FrostWall({ x: p.x + p.facing * 70, y: p.y - 40, vx: p.facing * 160, vy: 0, r: 40, dmg: 6, pierce: true, hitEvery: 0.2, life: 3, ex: true, meter: false, owner: p })); play('ice'); },
  },
};
export const WEAPON_ORDER = ['beer', 'whiskey', 'wine', 'champ', 'tequila', 'vodka'];

export const SUPERS = {
  lastcall: { name: 'Last Call', desc: 'A massive golden beam of liquid courage.', unlock: 'Starts unlocked' },
  courage: { name: 'Liquid Courage', desc: 'Become invincible for a few seconds.', unlock: 'Win the Bar Fight' },
  spirit: { name: 'Spirit Form', desc: 'A giant ghost bottle swoops across the screen.', unlock: 'Win the Bar Fight on Top Shelf' },
};
export const TRINKETS = {
  none: { name: 'No Trinket', desc: 'Nothing equipped.', price: 0 },
  opener: { name: 'Bottle Opener', desc: '+1 health. Weapons deal 5% less damage.', price: 3 },
  coaster: { name: 'Coaster', desc: 'You cannot be hit while dashing.', price: 3 },
  icebucket: { name: 'Ice Bucket', desc: 'Your super meter slowly fills by itself.', price: 3 },
  penny: { name: 'Lucky Penny', desc: 'The first hit you take each fight does no damage.', price: 3 },
  driver: { name: 'Designated Driver', desc: '+2 health, but weapons deal 15% less damage.', price: 5 },
};
