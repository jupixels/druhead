// Enemy projectiles and small enemies.
import { G, INK, PINK, rand } from './core.js';
import { circle, ellipse, starburst } from './draw.js';

export class Proj {
  constructor(o) {
    Object.assign(this, { vx: 0, vy: 0, r: 14, parry: false, grav: 0, life: 9, t: 0, dead: false, persist: false, color: '#ffe39a' }, o);
  }
  update(dt, w) {
    this.t += dt;
    if (this.tick) this.tick(dt, w, this);
    this.vy += this.grav * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    if (this.killOffscreen !== false && (this.x < w.camX - 300 || this.x > w.camX + 1580 || this.y > 1000 || this.y < -600)) this.dead = true;
  }
  hits(r) {
    if (this.rect) { const a = this.rect(); return a.x < r.x + r.w && a.x + a.w > r.x && a.y < r.y + r.h && a.y + a.h > r.y; }
    const cx = Math.max(r.x, Math.min(this.x, r.x + r.w)), cy = Math.max(r.y, Math.min(this.y, r.y + r.h));
    return (cx - this.x) ** 2 + (cy - this.y) ** 2 < (this.r * 0.85) ** 2;
  }
  draw(ctx, w) {
    if (this.render) return this.render(ctx, this, w);
    if (this.parry) return drawPinkOrb(ctx, this.x, this.y, this.r);
    circle(ctx, this.x, this.y, this.r, this.color, 3);
    circle(ctx, this.x - this.r * 0.3, this.y - this.r * 0.3, this.r * 0.3, 'rgba(255,255,255,.7)', 0);
  }
}

export function drawPinkOrb(ctx, x, y, r) {
  const p = 1 + Math.sin(G.time * 14) * 0.06;
  circle(ctx, x, y, r * p, PINK, 3);
  circle(ctx, x - r * 0.3, y - r * 0.35, r * 0.28, '#ffd2e8', 0);
}

// Cocktail cherry: the signature parryable object.
export function drawCherry(ctx, x, y, r) {
  ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.8); ctx.quadraticCurveTo(x + r * 0.4, y - r * 1.8, x + r, y - r * 1.9); ctx.stroke();
  drawPinkOrb(ctx, x, y, r);
}

export class Enemy {
  constructor(o) {
    Object.assign(this, { w: 50, h: 50, hp: 10, vx: 0, vy: 0, t: 0, dead: false, contact: true, parry: false, coin: false }, o);
  }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  takeDamage(d, w) {
    this.hp -= d; this.hitT = 0.06;
    if (this.hp <= 0 && !this.dead) { this.dead = true; this.onDeath ? this.onDeath(w, this) : w.popEnemy(this); }
  }
  update(dt, w) {
    this.t += dt; this.hitT = Math.max(0, (this.hitT || 0) - dt);
    if (this.tick) this.tick(dt, w, this);
    else { this.x += this.vx * dt; this.y += this.vy * dt; }
    if (this.x < w.camX - 400 || this.x > w.camX + 1700 || this.y > 1100) this.dead = true;
  }
  draw(ctx, w) {
    if (this.render) { ctx.save(); if (this.hitT > 0) ctx.globalAlpha = 0.7; this.render(ctx, this, w); ctx.restore(); return; }
    ellipse(ctx, this.x, this.y - this.h / 2, this.w / 2, this.h / 2, this.parry ? PINK : '#b44', 3);
  }
}
