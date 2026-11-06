// Level runtime: players, bullets, boss/enemies, collisions, particles, HUD.
import { G, W, H, INK, PINK, GROUND, clamp, rand, pick } from './core.js';
import { circle, ellipse, starburst, text, card, roundRect, panel, FONT_UI, FONT_TITLE } from './draw.js';
import { Player, METER_MAX } from './player.js';
import { players as INPUTS } from './input.js';
import { play } from './audio.js';
import { watercolorTex } from './fx.js';

export const DIFFS = ['Light', 'Regular', 'Top Shelf'];
const MUZZLE = { beer: '#fff3c0', whiskey: '#ffcf7a', wine: '#e0b0ff', champ: '#f0ffd0', tequila: '#d8ff9a', vodka: '#d8f4ff' };

// Draw something with a white "hit flash" tint (rendered through an offscreen layer).
let layer = null;
export function drawFlashed(ctx, fn, amount) {
  const c = ctx.canvas;
  if (!layer || layer.width !== c.width) { layer = document.createElement('canvas'); layer.width = c.width; layer.height = c.height; }
  const l = layer.getContext('2d');
  l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over'; l.globalAlpha = 1;
  l.clearRect(0, 0, layer.width, layer.height);
  l.setTransform(ctx.getTransform());
  fn(l);
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = 'source-atop';
  l.fillStyle = `rgba(255,255,240,${amount})`; l.fillRect(0, 0, layer.width, layer.height);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(layer, 0, 0); ctx.restore();
}
export function rumble(strength = 0.5, ms = 150, idx = -1) {
  try {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    pads.forEach((p, i) => { if ((idx < 0 || i === idx) && p.vibrationActuator) p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }); });
  } catch (_) {}
}

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
  muzzle(x, y, weapon) {
    const col = MUZZLE[weapon] || '#fff6d0';
    this.fx.push({ k: 'spark', x, y, color: col, s: 0.55, t: 0, life: 0.06, rot: rand(0, 6) });
    if (Math.random() < 0.35) this.fx.push({ k: 'ring', x, y, t: 0, life: 0.12, color: col, r0: 6, r1: 26 });
  }
  dust(x, y) {
    for (let i = 0; i < 2; i++) this.fx.push({ k: 'dust', x: x + rand(-6, 6), y: y - 4, vx: rand(-40, 40), vy: rand(-60, -20), r: rand(6, 11), t: 0, life: rand(0.3, 0.45) });
  }
  impact(x, y, color) {
    this.fx.push({ k: 'spark', x, y, color, s: 0.7, t: 0, life: 0.1, rot: rand(0, 6) });
    for (let i = 0; i < 3; i++) this.fx.push({ k: 'drop', x, y, vx: rand(-260, 260), vy: rand(-380, -60), color, r: rand(3, 6), t: 0, life: 0.4 });
  }
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
    for (const b of this.eBullets) this.puff(b.x, b.y, 20, '#fff');
    this.eBullets.length = 0;
    for (const e of this.enemies) if (!e.keepOnKo) { e.dead = true; this.popEnemy(e); }
    this.koFx();
    play('bell');
  }
  koFx() {
    G.hitstop = 0.35; this.flash = 0.5; G.shake = 22;
    play('announcer_ko'); rumble(0.9, 400);
    for (const p of this.players) if (!p.dead) p.victoryT = 0;
  }
  win() { if (this.state === 'play') { this.state = 'ko'; this.stateT = 0; this.eBullets = this.eBullets.filter((b) => b.harmless); this.koFx(); } }
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
      for (const p of this.players) {
        if (p.isPlane) { p.prop += dt * 40; p.y += Math.sin(this.t * 3 + p.idx) * 0.5; continue; }
        p.vx = 0; p.vy += 2700 * dt; p.move(dt, this); p.computeMuzzle && p.computeMuzzle();
        p.anim += dt; p.animate(dt, this); p.introT = this.stateT > 0.55 ? this.stateT - 0.55 : -1;
      }
      if (this.stateT > 2.2) for (const p of this.players) p.introT = -1;
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
      for (const p of this.players) if (!p.dead && !p.isPlane) { p.vx = 0; p.vy += 2700 * dt; p.move(dt, this); p.anim += dt; p.animate(dt, this); if (p.victoryT >= 0) p.victoryT += dt; }
      return;
    }
    this.stats.time += dt;
    if (!this.players.some((p) => !p.dead)) { this.lose(); return; }
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
    if (this.type === 'run' || this.type === 'plane') { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(watercolorTex(), 0, 0); ctx.restore(); }
    ctx.save();
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));
    if (this.def.drawMid) this.def.drawMid(ctx, this);
    for (const p of this.platforms) if (p.draw) p.draw(ctx, p, this); else if (this.def.drawPlatform) this.def.drawPlatform(ctx, p, this);
    for (const k of this.pickups) k.draw(ctx, this);
    if (this.boss) {
      if (this.boss.hitT > 0.02 && !this.boss.dying) drawFlashed(ctx, (c) => this.boss.draw(c, this), 0.42);
      else this.boss.draw(ctx, this);
    }
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
        ctx.beginPath(); ctx.arc(f.x, f.y, (f.r0 ?? 20) + k * ((f.r1 ?? 100) - (f.r0 ?? 20)), 0, 7); ctx.stroke();
      } else if (f.k === 'dust') {
        ctx.globalAlpha = (1 - k) * 0.9;
        circle(ctx, f.x + f.vx * f.t, f.y + f.vy * f.t, f.r * (0.6 + k * 0.8), '#efe3c0', 2);
        ctx.globalAlpha = 1;
      } else if (f.k === 'drop') {
        ctx.globalAlpha = 1 - k;
        circle(ctx, f.x + f.vx * f.t, f.y + f.vy * f.t + 900 * f.t * f.t, f.r * (1 - k * 0.5), f.color, 2);
        ctx.globalAlpha = 1;
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
      const x = left ? 26 : W - 26 - 210, y = H - 62;
      // HP card (tilted playing card, flashes red at 1 HP)
      const low = p.hp === 1 && !p.dead;
      p.hudHp = p.hudHp ?? p.hp; if (p.hudHp !== p.hp) { p.hudShake = 0.4; p.hudHp = p.hp; }
      p.hudShake = Math.max(0, (p.hudShake || 0) - 1 / 60);
      ctx.save(); ctx.translate(x + 38 + Math.sin(G.time * 60) * p.hudShake * 8, y + 22); ctx.rotate(-0.06);
      const col = p.dead ? '#666' : low ? (Math.floor(G.time * 5) % 2 ? '#e8453a' : '#fff4e0') : '#fff4e0';
      roundRect(ctx, -38, -22, 76, 44, 6, col, 3.5);
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.strokeRect(-33, -17, 66, 34);
      text(ctx, p.dead ? 'DEAD' : `HP. ${p.hp}`, 0, 2, 24, p.dead ? '#ddd' : low ? INK : '#7a1c1c', 'center', FONT_TITLE, 0);
      ctx.restore();
      // Super meter cards
      p.cardFlip = p.cardFlip || [1, 1, 1, 1, 1];
      p.cardFull = p.cardFull || [false, false, false, false, false];
      for (let c = 0; c < 5; c++) {
        const f = clamp((p.meter - c * 100) / 100, 0, 1);
        const full = f >= 1;
        if (full !== p.cardFull[c]) { p.cardFull[c] = full; p.cardFlip[c] = -1; }
        p.cardFlip[c] = Math.min(1, p.cardFlip[c] + 1 / 60 * 7);
        card(ctx, x + 88 + c * 24, y + 7 - (full && p.meter >= METER_MAX ? Math.abs(Math.sin(G.time * 8 + c)) * 4 : 0), f, p.meter >= METER_MAX, p.cardFlip[c]);
      }
      if (p.weapon) text(ctx, p.weapon.name.toUpperCase(), x + 4, y - 12, 15, '#fff6d8', 'left', FONT_UI, 4);
      if (this.coop) text(ctx, p.char.name.toUpperCase(), x + 4, y - 32, 15, i ? '#d6b2ff' : '#9fe0a8', 'left', FONT_UI, 4);
    });
    if (this.def.hud) this.def.hud(ctx, this);
  }

  drawOverlay(ctx) {
    if (this.state === 'intro') {
      const t = this.stateT;
      if (t > 0.4 && t < 2.25) {
        const out = t > 1.95 ? (t - 1.95) / 0.3 : 0;
        ctx.save(); ctx.translate(W / 2, H / 2 - 50); ctx.rotate(-0.04);
        ctx.globalAlpha = 1 - out;
        bounceWord(ctx, this.introText, t - 0.4, 96, '#ffe39a', out);
        ctx.restore();
        if (this.def.introSub && t > 0.8) { ctx.globalAlpha = Math.min(1, (t - 0.8) * 4) * (1 - out); text(ctx, this.def.introSub, W / 2, H / 2 + 45, 26, '#fff', 'center', FONT_UI, 6); ctx.globalAlpha = 1; }
      }
    }
    if (this.state === 'ko' && this.stateT < 2.8) {
      const t = this.stateT;
      const out = t > 2.4 ? (t - 2.4) / 0.4 : 0;
      ctx.save();
      // Sunburst rays behind the knockout text
      ctx.globalAlpha = Math.min(0.55, t * 2) * (1 - out);
      ctx.translate(W / 2, H / 2 - 30);
      ctx.rotate(G.time * 0.4);
      for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,240,180,.8)' : 'rgba(255,200,90,.5)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 900, (i / 16) * 6.283, ((i + 1) / 16) * 6.283); ctx.fill(); }
      ctx.restore();
      ctx.save(); ctx.translate(W / 2, H / 2 - 30); ctx.rotate(0.05); ctx.globalAlpha = 1 - out;
      bounceWord(ctx, this.def.winText || 'LAST CALL!', t, 124, '#ffe39a', 0, 0.035);
      ctx.restore();
    }
    if (this.state === 'lose' && this.stateT > 1.0) this.drawDeathCard(ctx);
  }

  drawDeathCard(ctx) {
    const a = clamp((this.stateT - 1) * 3, 0, 1);
    ctx.fillStyle = `rgba(20,8,0,${0.55 * a})`; ctx.fillRect(0, 0, W, H);
    ctx.save();
    const drop = (1 - a) * -400;
    ctx.translate(W / 2, 330 + drop); ctx.rotate(-0.03 + Math.sin(this.stateT * 2) * 0.004);
    panel(ctx, -320, -210, 640, 390);
    text(ctx, "YOU'RE CUT OFF!", 0, -150, 58, '#c0392b', 'center', FONT_TITLE, 6);
    text(ctx, `"${this.def.taunt || 'Come back when you can hold your liquor!'}"`, 0, -92, 22, INK, 'center', FONT_UI, 0);
    // Progress track like an old film strip
    const bx = -240, by = -20, bw = 480;
    ctx.fillStyle = INK; ctx.fillRect(bx - 10, by - 16, bw + 20, 32);
    ctx.fillStyle = '#f3e6c4'; for (let x = bx; x < bx + bw; x += 20) { ctx.fillRect(x, by - 12, 10, 5); ctx.fillRect(x, by + 7, 10, 5); }
    const marks = this.def.phaseMarks || [];
    for (const m of marks) { ctx.fillStyle = '#d9a93a'; ctx.beginPath(); ctx.arc(bx + bw * m, by, 7, 0, 7); ctx.fill(); }
    // Finish flag
    ctx.fillStyle = INK; ctx.fillRect(bx + bw + 6, by - 44, 4, 60);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = (r + c) % 2 ? INK : '#fff'; ctx.fillRect(bx + bw + 10 + c * 8, by - 44 + r * 8, 8, 8); }
    const pr = this.progress();
    const px = bx + bw * pr * Math.min(1, Math.max(0, (this.stateT - 1.2) * 1.4));
    // Little runner icon (the player's head) travelling the track
    ctx.save(); ctx.translate(px, by - 34 + Math.abs(Math.sin(this.stateT * 10)) * -4); ctx.scale(0.5, 0.5);
    const p0 = this.players[0]; if (p0 && p0.drawHead) p0.drawHead(ctx, 0, 30, 'hurt', 0);
    ctx.restore();
    text(ctx, `${Math.round(pr * 100)}% of the way there`, 0, 34, 22, INK, 'center', FONT_UI, 0);
    ctx.restore();
  }
}

// Kept for convenience in level files.
export { GROUND };

// Letters drop in one by one with a squashy bounce.
function bounceWord(ctx, word, t, size, color, out = 0, stagger = 0.045) {
  ctx.font = `${size}px ${FONT_TITLE}`;
  const total = ctx.measureText(word).width;
  let x = -total / 2;
  for (let i = 0; i < word.length; i++) {
    const ch = word[i], cw = ctx.measureText(ch).width;
    const lt = t - i * stagger;
    if (lt > 0) {
      const k = Math.min(1, lt / 0.22);
      const y = -(1 - k) * 160 + (k >= 1 ? Math.sin(Math.min(1, (lt - 0.22) / 0.25) * Math.PI) * -14 : 0) + Math.sin(G.time * 6 + i) * 2;
      const sq = k >= 1 && lt < 0.35 ? 0.8 : 1;
      ctx.save(); ctx.translate(x + cw / 2, y + out * 60); ctx.scale(1 / sq, sq); ctx.rotate(Math.sin(i * 1.7) * 0.05);
      text(ctx, ch, 4, 8, size, '#3b0d06', 'center', FONT_TITLE, 0);
      text(ctx, ch, 0, 0, size, color, 'center', FONT_TITLE, 12);
      ctx.restore();
    }
    x += cw;
  }
}
