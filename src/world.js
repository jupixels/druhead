// Level runtime: players, bullets, boss/enemies, collisions, particles, HUD.
import { G, W, H, INK, PINK, GROUND, clamp, rand, pick } from './core.js';
import { circle, ellipse, starburst, text, card, roundRect, FONT_UI, FONT_TITLE } from './draw.js';
import { Player, METER_MAX } from './player.js';
import { players as INPUTS } from './input.js';
import { play } from './audio.js';

export const DIFFS = ['Light', 'Regular', 'Top Shelf'];

export class World {
  constructor(def, opts) {
    this.def = def;
    this.type = def.type || 'boss';
    this.diff = opts.diff ?? 1;
    this.coop = opts.coop;
    this.camX = 0; this.camY = 0;
    this.bounds = { left: 20, right: W - 20 };
    this.platforms = [];
    this.pBullets = []; this.eBullets = []; this.enemies = []; this.fx = []; this.pickups = [];
    this.stats = { time: 0, hits: 0, coins: 0 };
    this.state = 'intro'; this.stateT = 0;
    this.flash = 0;
    this.slow = 1;
    this.t = 0;
    this.players = [];
    const n = opts.coop ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const p = def.makePlayer ? def.makePlayer(i, this, opts.loadouts[i]) : new Player(i, (def.spawnX || 200) + i * 70, GROUND, opts.loadouts[i]);
      this.players.push(p);
    }
    this.boss = null;
    def.setup(this);
    this.introText = def.introText || 'BOTTOMS UP!';
  }

  // ---------- Geometry ----------
  groundAt(x) {
    if (this.def.groundAt) return this.def.groundAt(x, this);
    return GROUND;
  }
  onPlatform(p) { return !!p.plat; }
  safeSpot(p) {
    const x = this.def.safeX ? this.def.safeX(p, this) : this.camX + 200;
    return { x, y: this.groundAt(x) < 9000 ? this.groundAt(x) - 200 : 200 };
  }

  // ---------- Targets ----------
  damageTargets() {
    const out = [];
    if (this.boss && !this.boss.dead) for (const hb of this.boss.hitboxes()) out.push({ rect: hb, ref: hb.ref || this.boss, mult: hb.mult || 1 });
    for (const e of this.enemies) if (!e.dead && e.hp > 0 && !e.invulnerable) out.push({ rect: e.rect(), ref: e, mult: 1 });
    return out;
  }
  nearestTarget(x, y) {
    let best = null, bd = 1e9;
    for (const t of this.damageTargets()) {
      const cx = t.rect.x + t.rect.w / 2, cy = t.rect.y + t.rect.h / 2;
      if (cx < this.camX - 50 || cx > this.camX + W + 50) continue;
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    return best;
  }
  applyDamage(t, dmg, b) {
    const owner = b && b.owner;
    let d = dmg * (t.mult || 1) * (owner && owner.dmgMult ? owner.dmgMult : 1);
    if (this.diff === 0) d *= 1.0;
    t.ref.takeDamage(d, this, b);
    if (owner && b.meter !== false && owner.addMeter) owner.addMeter(d * 0.85);
  }
  radialDamage(x, y, r, dmg, b) {
    for (const t of this.damageTargets()) {
      const R = t.rect;
      const cx = clamp(x, R.x, R.x + R.w), cy = clamp(y, R.y, R.y + R.h);
      if ((cx - x) ** 2 + (cy - y) ** 2 < r * r) this.applyDamage(t, dmg, b);
    }
    G.shake = Math.max(G.shake, 8);
  }

  // ---------- Effects ----------
  puff(x, y, r, color = '#fff') { this.fx.push({ k: 'puff', x, y, r, color, t: 0, life: 0.35 }); }
  spark(x, y, color = '#fff', s = 1) { this.fx.push({ k: 'spark', x, y, color, s, t: 0, life: 0.14, rot: rand(0, 6) }); }
  muzzle(x, y) { this.fx.push({ k: 'spark', x, y, color: '#fff6d0', s: 0.45, t: 0, life: 0.05, rot: rand(0, 6) }); }
  speedLine(x, y, dir) { this.fx.push({ k: 'line', x, y, dir, t: 0, life: 0.18 }); }
  popText(x, y, str, color = '#fff', size = 30) { this.fx.push({ k: 'text', x, y, str, color, size, t: 0, life: 1 }); }
  debris(x, y, color, n = 6, size = 10) {
    for (let i = 0; i < n; i++) this.fx.push({ k: 'debris', x, y, vx: rand(-350, 350), vy: rand(-700, -200), color, size: rand(size * 0.5, size), t: 0, life: 1.4, rot: rand(0, 6), vr: rand(-10, 10) });
  }
  parryFx(x, y) {
    this.fx.push({ k: 'ring', x, y, t: 0, life: 0.3, color: PINK });
    this.fx.push({ k: 'spark', x, y, color: PINK, s: 1.8, t: 0, life: 0.2, rot: 0 });
    this.popText(x, y - 40, 'PARRY!', '#ff9ccc', 26);
  }
  hitFx(x, y) { this.fx.push({ k: 'spark', x, y, color: '#fff', s: 2.2, t: 0, life: 0.2, rot: rand(0, 6) }); }
  explode(x, y, s = 1) {
    this.fx.push({ k: 'boom', x, y, s, t: 0, life: 0.5, rot: rand(0, 6) });
    for (let i = 0; i < 3; i++) this.puff(x + rand(-40, 40) * s, y + rand(-40, 40) * s, 40 * s, '#efe3c0');
  }
  popEnemy(e) {
    const r = e.rect();
    this.explode(r.x + r.w / 2, r.y + r.h / 2, 0.6);
    play('enemy_pop', { vary: 0.1 });
  }

  // ---------- Players ----------
  onPlayerDown(p) {
    const alive = this.players.filter((q) => !q.dead);
    if (!alive.length) this.lose();
    else this.popText(p.x, p.y - 140, 'PARRY THE HEART TO REVIVE!', '#ff9ccc', 22);
  }
  alivePlayers() { return this.players.filter((p) => !p.dead); }
  nearestPlayer(x, y) {
    let best = null, bd = 1e9;
    for (const p of this.alivePlayers()) { const d = Math.abs(p.x - x) + Math.abs(p.y - y) * 0.5; if (d < bd) { bd = d; best = p; } }
    return best || this.players[0];
  }

  // ---------- Flow ----------
  bossDefeated() {
    if (this.state !== 'play') return;
    this.state = 'ko'; this.stateT = 0;
    this.eBullets.length = 0;
    for (const e of this.enemies) if (!e.keepOnKo) { e.dead = true; }
    play('announcer_ko');
    play('bell');
  }
  win() { if (this.state === 'play') { this.state = 'ko'; this.stateT = 0; play('announcer_ko'); } }
  lose() {
    if (this.state !== 'play') return;
    this.state = 'lose'; this.stateT = 0;
    play('announcer_lose');
  }
  progress() {
    if (this.def.progress) return this.def.progress(this);
    if (!this.boss) return 0;
    return clamp(1 - this.boss.hp / this.boss.maxHp, 0, 1);
  }

  update(dt) {
    this.t += dt;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    if (this.state === 'intro') {
      for (const p of this.players) { if (p.isPlane) { p.prop += dt * 40; continue; } p.vx = 0; p.vy += 2700 * dt; p.move(dt, this); p.computeMuzzle && p.computeMuzzle(); }
      if (this.boss) this.boss.introUpdate ? this.boss.introUpdate(dt, this) : null;
      if (this.stateT > 2.2) { this.state = 'play'; this.stateT = 0; }
      if (this.stateT > 0.5 && this.stateT - dt <= 0.5) play('announcer_start');
      this.updateFx(dt);
      return;
    }
    if (this.state === 'lose') { this.updateFx(dt); for (const p of this.players) p.update(dt, this, INPUTS[p.idx]); return; }
    if (this.state === 'ko') {
      dt *= this.stateT < 1.6 ? 0.3 : 1;
      if (this.boss) this.boss.deathUpdate ? this.boss.deathUpdate(dt, this) : null;
      this.updateFx(dt);
      for (const p of this.players) if (!p.dead && !p.isPlane) { p.vx = 0; p.vy += 2700 * dt; p.move(dt, this); }
      return;
    }
    this.stats.time += dt;
    for (const p of this.players) p.update(dt, this, INPUTS[p.idx]);
    if (this.def.update) this.def.update(dt, this);
    if (this.boss && !this.boss.dead) this.boss.update(dt, this);
    for (const e of this.enemies) e.update(dt, this);
    for (const b of this.pBullets) b.update(dt, this);
    for (const b of this.eBullets) b.update(dt, this);
    for (const k of this.pickups) k.update && k.update(dt, this);
    this.collide();
    this.updateFx(dt);
    this.pBullets = this.pBullets.filter((b) => !b.dead);
    this.eBullets = this.eBullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.pickups = this.pickups.filter((k) => !k.dead);
  }

  collide() {
    const targets = this.damageTargets();
    for (const b of this.pBullets) {
      if (b.dead || b.noCollide) continue;
      for (const t of targets) {
        const R = t.rect;
        const cx = clamp(b.x, R.x, R.x + R.w), cy = clamp(b.y, R.y, R.y + R.h);
        if ((cx - b.x) ** 2 + (cy - b.y) ** 2 < b.r * b.r && b.canHit(t.ref)) {
          this.applyDamage(t, b.dmg, b);
          b.onHit(t.ref, this);
          if (b.dead) break;
        }
      }
    }
    const alive = this.alivePlayers();
    for (const p of alive) {
      const pr = p.rect();
      // Parry revive hearts
      for (const q of this.players) {
        if (q.dead && q.heartObj && q !== p && p.tryParry(q.heartObj, this)) q.revive(this);
      }
      for (const e of this.eBullets) {
        if (e.dead) continue;
        if (e.parry && p.tryParry(e, this)) { if (e.onParry) e.onParry(this, p); else e.dead = true; continue; }
        if (e.harmless) continue;
        if (e.hits(pr)) { p.takeHit(this); if (!e.persist) e.dead = true; }
      }
      for (const e of this.enemies) {
        if (e.dead || !e.contact) continue;
        const r = e.rect();
        if (e.parry && p.tryParry({ x: r.x + r.w / 2, y: r.y + r.h / 2, r: Math.max(r.w, r.h) / 2 }, this)) { e.onParry ? e.onParry(this, p) : (e.dead = true, this.popEnemy(e)); continue; }
        if (r.x < pr.x + pr.w && r.x + r.w > pr.x && r.y < pr.y + pr.h && r.y + r.h > pr.y) p.takeHit(this);
      }
      if (this.boss && !this.boss.dead && this.boss.hurtboxes) {
        for (const r of this.boss.hurtboxes()) {
          if (r.parry && p.tryParry({ x: r.x + r.w / 2, y: r.y + r.h / 2, r: Math.max(r.w, r.h) / 2 }, this)) { r.onParry && r.onParry(this, p); continue; }
          if (r.x < pr.x + pr.w && r.x + r.w > pr.x && r.y < pr.y + pr.h && r.y + r.h > pr.y) p.takeHit(this);
        }
      }
      for (const k of this.pickups) {
        if (!k.dead && Math.abs(k.x - p.x) < 40 && Math.abs(k.y - (p.y - 40)) < 60) k.collect(this, p);
      }
    }
  }

  updateFx(dt) {
    for (const f of this.fx) {
      f.t += dt;
      if (f.k === 'debris') { f.vy += 1800 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
      if (f.k === 'text') f.y -= 40 * dt;
    }
    this.fx = this.fx.filter((f) => f.t < f.life);
  }

  // ---------- Drawing ----------
  draw(ctx) {
    ctx.save();
    if (this.def.drawBg) this.def.drawBg(ctx, this);
    ctx.save();
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));
    if (this.def.drawMid) this.def.drawMid(ctx, this);
    for (const p of this.platforms) if (p.draw) p.draw(ctx, p, this); else if (this.def.drawPlatform) this.def.drawPlatform(ctx, p, this);
    for (const k of this.pickups) k.draw(ctx, this);
    if (this.boss) this.boss.draw(ctx, this);
    for (const e of this.enemies) e.draw(ctx, this);
    for (const p of this.players) if (!p.dead) p.draw(ctx);
    for (const b of this.pBullets) b.draw(ctx);
    for (const b of this.eBullets) b.draw(ctx, this);
    if (this.boss && this.boss.drawFront) this.boss.drawFront(ctx, this);
    for (const p of this.players) if (p.dead) p.draw(ctx);
    this.drawFx(ctx);
    ctx.restore();
    if (this.def.drawFg) this.def.drawFg(ctx, this);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,250,230,${this.flash * 2})`; ctx.fillRect(0, 0, W, H); }
    this.drawHud(ctx);
    this.drawOverlay(ctx);
    ctx.restore();
  }

  drawFx(ctx) {
    for (const f of this.fx) {
      const k = f.t / f.life;
      if (f.k === 'puff') {
        ctx.globalAlpha = 1 - k;
        circle(ctx, f.x, f.y, f.r * (0.5 + k * 0.8), f.color, 2.5);
        ctx.globalAlpha = 1;
      } else if (f.k === 'spark') {
        starburst(ctx, f.x, f.y, 26 * f.s * (1 - k * 0.5), 6, f.color, f.rot, 2.5);
      } else if (f.k === 'line') {
        ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.dir * 50, f.y); ctx.stroke();
      } else if (f.k === 'text') {
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        text(ctx, f.str, f.x, f.y, f.size, f.color, 'center', FONT_TITLE, 5);
        ctx.globalAlpha = 1;
      } else if (f.k === 'debris') {
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        roundRect(ctx, -f.size / 2, -f.size / 2, f.size, f.size * 0.7, 2, f.color, 2);
        ctx.restore();
      } else if (f.k === 'ring') {
        ctx.strokeStyle = f.color; ctx.lineWidth = 6 * (1 - k);
        ctx.beginPath(); ctx.arc(f.x, f.y, 20 + k * 80, 0, 7); ctx.stroke();
      } else if (f.k === 'boom') {
        starburst(ctx, f.x, f.y, 70 * f.s * (0.6 + k), 9, k < 0.3 ? '#fff6c0' : '#ffb347', f.rot, 4);
        circle(ctx, f.x, f.y, 30 * f.s * (1 - k), '#fff', 0);
      }
    }
  }

  drawHud(ctx) {
    if (this.def.hideHud) return;
    this.players.forEach((p, i) => {
      const left = i === 0;
      const x = left ? 24 : W - 24 - 230, y = H - 56;
      // HP card
      const low = p.hp === 1 && !p.dead;
      const col = p.dead ? '#555' : low ? (Math.floor(G.time * 6) % 2 ? '#e04040' : '#fff') : '#f3e6c4';
      roundRect(ctx, x, y, 78, 38, 5, col, 3);
      text(ctx, p.dead ? 'DEAD' : `HP ${p.hp}`, x + 39, y + 20, 22, p.dead ? '#bbb' : INK, 'center', FONT_UI, 0);
      // Meter cards
      for (let c = 0; c < 5; c++) {
        const f = clamp((p.meter - c * 100) / 100, 0, 1);
        card(ctx, x + 88 + c * 22, y + 6, f, p.meter >= METER_MAX);
      }
      if (p.weapon) text(ctx, p.weapon.name, x + 2, y - 14, 16, '#fff', 'left', FONT_UI, 4);
      if (this.coop) text(ctx, p.char.name.toUpperCase(), x + 2, y - 34, 15, i ? '#d6b2ff' : '#9fe0a8', 'left', FONT_UI, 4);
    });
    if (this.def.hud) this.def.hud(ctx, this);
  }

  drawOverlay(ctx) {
    if (this.state === 'intro') {
      const t = this.stateT;
      if (t > 0.4 && t < 2.2) {
        const s = t < 0.6 ? 0.6 + (t - 0.4) * 2 : 1;
        ctx.save(); ctx.translate(W / 2, H / 2 - 40); ctx.scale(s, s); ctx.rotate(-0.05);
        text(ctx, this.introText, 0, 0, 92, '#ffe39a', 'center', FONT_TITLE, 12);
        ctx.restore();
        if (this.def.introSub) text(ctx, this.def.introSub, W / 2, H / 2 + 40, 26, '#fff', 'center', FONT_UI, 6);
      }
    }
    if (this.state === 'ko' && this.stateT < 2.6) {
      const t = this.stateT;
      const s = Math.min(1, t * 4);
      ctx.save(); ctx.translate(W / 2, H / 2 - 30); ctx.scale(s, s); ctx.rotate(0.04);
      text(ctx, this.def.winText || 'LAST CALL!', 0, 0, 120, '#ffe39a', 'center', FONT_TITLE, 14);
      ctx.restore();
    }
    if (this.state === 'lose' && this.stateT > 1.0) this.drawDeathCard(ctx);
  }

  drawDeathCard(ctx) {
    const a = clamp((this.stateT - 1) * 3, 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.45 * a})`; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = a;
    const x = W / 2 - 300, y = 150;
    roundRect(ctx, x, y, 600, 400, 14, '#f3e6c4', 6);
    text(ctx, pick(['YOU\'RE CUT OFF!']), W / 2, y + 60, 54, '#c0392b', 'center', FONT_TITLE, 6);
    text(ctx, `"${this.def.taunt || 'Come back when you can hold your liquor!'}"`, W / 2, y + 120, 22, INK, 'center', FONT_UI, 0);
    // Progress bar
    const bx = x + 60, by = y + 175, bw = 480;
    ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.stroke();
    const marks = this.def.phaseMarks || [];
    for (const m of marks) { ctx.beginPath(); ctx.moveTo(bx + bw * m, by - 12); ctx.lineTo(bx + bw * m, by + 12); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(bx + bw, by - 18); ctx.lineTo(bx + bw, by + 18); ctx.stroke();
    text(ctx, '🏁', bx + bw + 22, by, 24, INK, 'center', FONT_UI, 0);
    const pr = this.progress();
    const px = bx + bw * pr * Math.min(1, (this.stateT - 1) * 1.2);
    this.def.drawProgressIcon ? this.def.drawProgressIcon(ctx, px, by) : circle(ctx, px, by, 14, '#c9762a', 3);
    text(ctx, `${Math.round(pr * 100)}% there`, W / 2, by + 44, 22, INK, 'center', FONT_UI, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// Kept for convenience in level files.
export { GROUND };
