// Player characters: Shotty (shot glass head) and Pint (pint glass head).
import { G, INK, PINK, clamp, rand, wob } from './core.js';
import { ellipse, circle, poly, hose, pieEye, glove, shoe, mouth, roundRect } from './draw.js';
import { WEAPONS, Beam, Spirit } from './weapons.js';
import { play } from './audio.js';

const GRAV = 2700, JUMP_V = -1000, RUN = 345, DASH_V = 800, DASH_T = 0.25;
export const METER_MAX = 500;

export const CHARACTERS = [
  { name: 'Shotty', head: 'shot', shorts: '#2f7d4a', shoe: '#5a2e12' },
  { name: 'Pint', head: 'pint', shorts: '#6b3f8f', shoe: '#2c2c4a' },
];

export class Player {
  constructor(idx, x, y, loadout) {
    this.idx = idx;
    this.char = CHARACTERS[idx];
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.facing = 1;
    this.onGround = false; this.coyote = 0; this.jumpBuf = 0;
    this.airDash = false; this.dashT = 0; this.dashCd = 0;
    this.parryT = 0; this.parryUsed = false; this.parryFlash = 0;
    this.weapons = loadout.weapons.slice(0, 2);
    this.wIdx = 0;
    this.superId = loadout.super || 'lastcall';
    this.trinket = loadout.trinket || 'none';
    this.maxHp = 3 + (this.trinket === 'opener' ? 1 : 0) + (this.trinket === 'driver' ? 2 : 0);
    this.dmgMult = this.trinket === 'opener' ? 0.95 : this.trinket === 'driver' ? 0.85 : 1;
    this.pennyUsed = false;
    this.hp = this.maxHp;
    this.meter = 0;
    this.invuln = 0; this.hurtT = 0;
    this.fireCd = 0; this.charge = 0;
    this.exT = 0; this.superT = 0; this.superKind = null; this.courage = 0;
    this.duck = false; this.lock = false;
    this.aimX = 1; this.aimY = 0;
    this.anim = 0; this.dropT = 0;
    this.dead = false; this.ghostY = 0; this.ghostT = 0;
    this.mx = x; this.my = y; this.alt = 1;
    this.w = 36; this.h = 84;
    this.landT = 0;
    this.stats = { hits: 0, parries: 0, supers: 0, ex: 0 };
  }

  get weapon() { return WEAPONS[this.weapons[this.wIdx]]; }

  rect() {
    const h = this.duck ? 50 : this.dashT > 0 ? 60 : this.h;
    return { x: this.x - this.w / 2, y: this.y - h, w: this.w, h };
  }

  update(dt, w, inp) {
    if (this.dead) return this.updateGhost(dt, w);
    this.anim += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.parryFlash = Math.max(0, this.parryFlash - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.courage = Math.max(0, this.courage - dt);
    if (this.trinket === 'icebucket') this.addMeter(5 * dt);

    // Supers and EX freeze movement briefly.
    if (this.superT > 0) {
      this.superT -= dt; this.vx = 0; this.vy = 0;
      if (this.superT <= 0) this.superKind = null;
      this.computeMuzzle();
      return;
    }
    if (this.hurtT > 0) {
      this.hurtT -= dt;
      this.vy += GRAV * dt;
      this.move(dt, w);
      return;
    }
    if (this.exT > 0) { this.exT -= dt; this.vx = -this.facing * 120; this.vy = 0; this.move(dt, w); return; }

    const ax = inp.ax, ay = inp.ay;
    this.lock = inp.held.lock;
    this.duck = this.onGround && ay > 0 && !this.lock && this.dashT <= 0;

    // Dash
    this.dashCd = Math.max(0, this.dashCd - dt);
    if (inp.pressed.dash && this.dashT <= 0 && this.dashCd <= 0 && (this.onGround || !this.airDash)) {
      if (ax) this.facing = Math.sign(ax);
      this.dashT = DASH_T;
      if (!this.onGround) this.airDash = true;
      this.dashCd = 0.12;
      play('dash', { vary: 0.08 });
      w.puff(this.x - this.facing * 20, this.y - 30, 26, '#fff');
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.facing * DASH_V; this.vy = 0;
      this.move(dt, w);
      if (Math.random() < 0.5) w.speedLine(this.x - this.facing * 30, this.y - rand(20, 70), this.facing);
      this.computeMuzzle();
      return;
    }

    // Aim
    if (ax) this.facing = Math.sign(ax);
    let aX = ax, aY = ay;
    if (!this.lock) {
      if (this.onGround && ay > 0) { aX = this.facing; aY = 0; }
      else if (aY === 0) aX = this.facing;
      if (this.onGround && aY > 0) aY = 0;
    } else if (!aX && !aY) aX = this.facing;
    const len = Math.hypot(aX, aY) || 1;
    this.aimX = aX / len; this.aimY = aY / len;

    // Run
    const canMove = !this.lock && !this.duck;
    const target = canMove ? ax * RUN : 0;
    this.vx = target;

    // Jump + parry
    this.coyote = this.onGround ? 0.08 : Math.max(0, this.coyote - dt);
    this.jumpBuf = inp.pressed.jump ? 0.1 : Math.max(0, this.jumpBuf - dt);
    this.parryT = Math.max(0, this.parryT - dt);
    if (this.jumpBuf > 0 && this.onGround && ay > 0 && w.onPlatform(this)) {
      this.dropT = 0.25; this.onGround = false; this.jumpBuf = 0; this.y += 2;
    } else if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
      this.vy = JUMP_V; this.onGround = false; this.coyote = 0; this.jumpBuf = 0;
      this.parryUsed = false;
      play('jump', { vary: 0.08 });
    } else if (inp.pressed.jump && !this.onGround && !this.parryUsed) {
      this.parryT = 0.2; this.parryUsed = true;
    }
    if (!inp.held.jump && this.vy < -300) this.vy *= 0.6; // variable jump height
    this.dropT = Math.max(0, this.dropT - dt);
    this.vy += GRAV * dt;
    if (this.vy > 1500) this.vy = 1500;
    this.move(dt, w);

    // Weapon swap
    if (inp.pressed.swap && this.weapons.length > 1) {
      this.wIdx = 1 - this.wIdx; this.charge = 0;
      w.popText(this.x, this.y - 140, this.weapon.name, '#ffe39a', 22);
      play('menu_move');
    }

    this.computeMuzzle();

    // Shooting
    this.fireCd -= dt;
    const wp = this.weapon;
    if (this.noShoot) { /* Bar Fight: parry only */ }
    else if (wp.charge) {
      if (inp.held.shoot) {
        this.charge += dt;
        if (this.charge >= 0.75 && this.charge - dt < 0.75) { play('charge_up'); w.spark(this.mx, this.my, '#c8ff80', 1); }
        if (this.fireCd <= 0 && this.charge < 0.2 && inp.pressed.shoot) { /* wait for release */ }
      }
      if (inp.released.shoot) {
        if (this.fireCd <= 0) { wp.fire(w, this, Math.atan2(this.aimY, this.aimX), this.charge >= 0.75); this.fireCd = wp.rate; }
        this.charge = 0;
      }
    } else if (inp.held.shoot && this.fireCd <= 0) {
      wp.fire(w, this, Math.atan2(this.aimY, this.aimX));
      this.fireCd = wp.rate;
      w.muzzle(this.mx, this.my);
    }

    // EX / Super
    if (inp.pressed.ex && !this.noShoot) {
      if (this.meter >= METER_MAX) this.doSuper(w);
      else if (this.meter >= 100) this.doEx(w);
    }
  }

  computeMuzzle() {
    const sx = this.x + this.facing * 8, sy = this.y - (this.duck ? 30 : 56);
    this.mx = sx + this.aimX * 42; this.my = sy + this.aimY * 42;
  }

  doEx(w) {
    this.meter -= 100;
    this.exT = 0.28;
    this.stats.ex++;
    this.weapon.exFire(w, this, Math.atan2(this.aimY, this.aimX));
    play('ex_shot');
    w.puff(this.mx, this.my, 50, '#fff');
    G.hitstop = Math.max(G.hitstop, 0.05);
  }

  doSuper(w) {
    this.meter = 0;
    this.stats.supers++;
    this.superKind = this.superId;
    this.invuln = Math.max(this.invuln, 0.3);
    w.flash = 0.25;
    G.hitstop = 0.15;
    if (this.superId === 'lastcall') {
      this.superT = 1.7; this.invuln = 2;
      w.pBullets.push(new Beam({ x: this.x, y: this.y - 50, owner: this, facing: this.facing, dmg: 5.5 }));
      play('super_beam');
    } else if (this.superId === 'courage') {
      this.superT = 0.5; this.courage = 5.5; this.invuln = 6;
      play('super_invincible');
    } else {
      this.superT = 2.2; this.invuln = 2.6;
      w.pBullets.push(new Spirit({ x: this.x, y: this.y, owner: this, facing: this.facing, dmg: 11 }));
      play('super_ghost');
    }
  }

  addMeter(v) {
    const before = Math.floor(this.meter / 100);
    this.meter = clamp(this.meter + v, 0, METER_MAX);
    if (Math.floor(this.meter / 100) > before) play('card_ready', { volume: 0.6 });
  }

  move(dt, w) {
    const prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const b = w.bounds;
    this.x = clamp(this.x, b.left + this.w / 2, b.right - this.w / 2);
    const wasGround = this.onGround;
    this.onGround = false;
    const g = w.groundAt(this.x);
    if (this.y >= g && g < 9000) { this.y = g; if (this.vy > 0) this.vy = 0; this.onGround = true; }
    else if (this.vy >= 0 && this.dropT <= 0) {
      for (const p of w.platforms) {
        if (this.x > p.x - 6 && this.x < p.x + p.w + 6 && prevY <= p.y + 1 && this.y >= p.y) {
          this.y = p.y; this.vy = 0; this.onGround = true; this.plat = p; break;
        }
      }
    }
    if (this.onGround && this.plat && this.plat.vx) this.x += this.plat.vx * dt;
    if (!this.onGround) this.plat = null;
    if (this.onGround && !wasGround) {
      this.airDash = false; this.parryUsed = false; this.landT = 0.12;
      if (this.vy >= 0) play('land', { vary: 0.1, volume: 0.6 });
      w.puff(this.x, this.y - 4, 16, '#efe3c0');
    }
    if (this.y > 900) { // fell into a pit
      this.takeHit(w, true);
      if (!this.dead) { const s = w.safeSpot(this); this.x = s.x; this.y = s.y; this.vy = 0; }
    }
  }

  // Attempt to parry `obj` (has x,y,r). Returns true on success.
  tryParry(obj, w) {
    if (this.dead || this.parryT <= 0) return false;
    const r = this.rect();
    const cx = clamp(obj.x, r.x - 20, r.x + r.w + 20), cy = clamp(obj.y, r.y - 20, r.y + r.h + 20);
    if ((cx - obj.x) ** 2 + (cy - obj.y) ** 2 > (obj.r + 8) ** 2) return false;
    this.vy = -900; this.parryT = 0; this.parryUsed = false; this.airDash = false;
    this.parryFlash = 0.25;
    this.addMeter(100);
    this.stats.parries++;
    G.hitstop = 0.14;
    play('parry');
    w.parryFx(obj.x, obj.y);
    return true;
  }

  takeHit(w, pit = false) {
    if (this.dead) return;
    if (!pit && (this.invuln > 0 || (this.dashT > 0 && this.trinket === 'coaster'))) return;
    if (!pit && this.trinket === 'penny' && !this.pennyUsed) {
      this.pennyUsed = true; this.invuln = 1.2; w.popText(this.x, this.y - 120, 'LUCKY!', '#ffd84a', 28); play('coin'); return;
    }
    this.hp -= 1;
    this.stats.hits++;
    w.stats.hits++;
    this.invuln = 1.8; this.hurtT = pit ? 0 : 0.3;
    this.vx = -this.facing * 160; this.vy = pit ? -1300 : -420;
    this.dashT = 0; this.charge = 0;
    G.hitstop = 0.12; G.shake = Math.max(G.shake, 10);
    play('player_hit');
    w.hitFx(this.x, this.y - 50);
    if (this.hp <= 0) this.die(w);
  }

  die(w) {
    this.dead = true; this.hp = 0; this.ghostY = Math.min(this.y, 640) - 60; this.ghostT = 0;
    this.x = clamp(this.x, w.bounds.left + 60, w.bounds.right - 60);
    play('player_die');
    w.onPlayerDown(this);
  }

  updateGhost(dt, w) {
    this.ghostT += dt;
    this.ghostY -= 70 * dt;
    this.heartObj = { x: this.x + Math.sin(this.ghostT * 3) * 20, y: this.ghostY - 50, r: 22 };
  }

  revive(w) {
    this.dead = false; this.hp = 1; this.invuln = 2.5;
    this.y = Math.min(w.groundAt(this.x), this.ghostY + 100);
    if (this.y < 100) this.y = 300;
    this.vy = -400;
    play('revive');
    w.popText(this.x, this.y - 140, 'BACK ON YOUR FEET!', '#ff9ccc', 26);
  }

  // ---------------- Drawing ----------------
  draw(ctx) {
    if (this.dead) return this.drawGhost(ctx);
    if (this.invuln > 0 && this.courage <= 0 && this.superT <= 0 && Math.floor(this.invuln * 20) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 6, 0, 0, 7); ctx.fill();
    ctx.scale(this.facing, 1);
    if (this.courage > 0) {
      ctx.save(); ctx.globalAlpha = 0.45 + Math.sin(G.time * 20) * 0.2;
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(0, -60, 55, 80, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    const c = this.char;
    const air = !this.onGround;
    const run = this.onGround && Math.abs(this.vx) > 10 && !this.duck;
    const ph = this.anim * 13;
    const bob = run ? Math.abs(Math.sin(ph)) * -5 : Math.sin(this.anim * 4) * 1.5;
    let lean = 0;
    if (this.dashT > 0) lean = 0.35;
    if (this.hurtT > 0) lean = -0.3;
    if (this.exT > 0) lean = -0.2;
    ctx.rotate(lean);
    const duck = this.duck ? 1 : 0;
    const sq = this.landT > 0 ? 0.88 : 1;
    ctx.scale(1, sq);
    // Aim in local (flipped) space.
    const lax = this.aimX * this.facing, lay = this.aimY;

    // Legs
    let f1x = -9, f1y = 0, f2x = 9, f2y = 0;
    if (run) { f1x = Math.sin(ph) * 16; f1y = -Math.max(0, Math.cos(ph)) * 10; f2x = -Math.sin(ph) * 16; f2y = -Math.max(0, -Math.cos(ph)) * 10; }
    if (air) { f1x = -12; f1y = -18; f2x = 10; f2y = -12; }
    if (this.dashT > 0) { f1x = -30; f1y = -18; f2x = -18; f2y = -6; }
    if (duck) { f1x = -16; f2x = 16; }
    const hipY = duck ? -14 : -30 + bob;
    hose(ctx, -5, hipY, -7, (hipY + f1y) / 2, f1x, f1y - 6, 6, INK);
    hose(ctx, 5, hipY, 7, (hipY + f2y) / 2, f2x, f2y - 6, 6, INK);
    shoe(ctx, f1x, f1y, 1, c.shoe);
    shoe(ctx, f2x, f2y, 1, c.shoe);

    // Back arm
    const shY = (duck ? -32 : -56) + bob;
    const swing = run ? Math.sin(ph + Math.PI) * 14 : 0;
    hose(ctx, -6, shY, -18, shY + 8, -16 + swing, shY + 22, 6, '#fff');
    glove(ctx, -16 + swing, shY + 24, 8);

    // Torso
    const ty = (duck ? -26 : -46) + bob;
    ellipse(ctx, 0, ty, 16, duck ? 13 : 18, '#fbf6ea', 3);
    // Shorts
    ctx.save();
    ctx.beginPath(); ctx.ellipse(0, ty, 16, duck ? 13 : 18, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = c.shorts; ctx.fillRect(-20, ty + 2, 40, 30);
    ctx.restore();
    ellipse(ctx, 0, ty, 16, duck ? 13 : 18, null, 3);
    circle(ctx, -7, ty + 8, 2.5, '#fff', 1.5); circle(ctx, 7, ty + 8, 2.5, '#fff', 1.5);

    // Head
    const hy = (duck ? -42 : -66) + bob;
    this.drawHead(ctx, 2, hy, lean);

    // Front (aiming) arm
    let hx, hyy;
    if (this.parryT > 0 || this.parryFlash > 0) { hx = 14; hyy = shY - 30; }
    else { hx = 8 + lax * 30; hyy = shY + 2 + lay * 30; }
    hose(ctx, 6, shY, (6 + hx) / 2 + 4, (shY + hyy) / 2 + 6, hx, hyy, 6, '#fff');
    glove(ctx, hx, hyy, 9, Math.atan2(lay, lax), this.parryT <= 0);
    if (this.parryFlash > 0) { circle(ctx, hx, hyy, 22 * (this.parryFlash / 0.25) + 6, 'rgba(255,95,168,.6)', 0); }
    // Charge glow
    if (this.charge > 0.15 && this.weapon.charge) {
      const k = Math.min(1, this.charge / 0.75);
      ctx.fillStyle = k >= 1 ? (Math.floor(G.time * 20) % 2 ? '#e6ff9a' : '#9cff4a') : 'rgba(180,255,120,.6)';
      ctx.beginPath(); ctx.arc(hx + lax * 14, hyy + lay * 14, 4 + k * 14, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  drawHead(ctx, x, by, lean) {
    const pint = this.char.head === 'pint';
    const tw = pint ? 30 : 31, bw = pint ? 23 : 21, hh = pint ? 66 : 54;
    const top = by - hh;
    const hurt = this.hurtT > 0;
    const blink = Math.floor(this.anim * 10) % 37 === 0;
    // Glass body
    const glassPts = [[x - tw, top], [x + tw, top], [x + bw, by], [x - bw, by]];
    poly(ctx, glassPts, 'rgba(225,240,250,.95)', 0);
    // Liquid
    const lt = top + (pint ? 14 : 10);
    const tAt = (y) => (y - top) / hh;
    const wAt = (y) => tw + (bw - tw) * tAt(y);
    ctx.beginPath();
    ctx.moveTo(x - wAt(lt) + 2, lt);
    for (let i = 0; i <= 8; i++) { const px = x - wAt(lt) + 2 + (i / 8) * (wAt(lt) * 2 - 4); ctx.lineTo(px, lt + Math.sin(G.time * 6 + i) * 1.6); }
    ctx.lineTo(x + bw - 2, by - (pint ? 4 : 9)); ctx.lineTo(x - bw + 2, by - (pint ? 4 : 9)); ctx.closePath();
    ctx.fillStyle = pint ? '#e8a634' : '#c9762a'; ctx.fill();
    // Thick base for shot glass
    if (!pint) { ctx.fillStyle = 'rgba(200,225,240,.95)'; ctx.fillRect(x - bw + 1, by - 9, bw * 2 - 2, 8); }
    // Bubbles in beer
    if (pint) for (let i = 0; i < 4; i++) circle(ctx, x - 12 + i * 8, by - 8 - ((G.time * 40 + i * 13) % 36), 1.6, '#fff3c4', 0);
    // Outline
    poly(ctx, glassPts, null, 3.5, 7);
    // Highlight
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - tw + 7, top + 10); ctx.lineTo(x - bw + 6, by - 14); ctx.stroke();
    // Rim
    ellipse(ctx, x, top, tw, 6, 'rgba(240,250,255,.95)', 3);
    if (pint) {
      // Foam head spilling over the rim
      const fy = top - 2;
      for (let i = 0; i < 6; i++) circle(ctx, x - tw + 4 + i * 10.5, fy - 4 + Math.sin(i * 2.1) * 3 + wob(i + 3, 0.8), 9, '#fffdf3', 2.5);
      ctx.fillStyle = '#fffdf3'; ctx.fillRect(x - tw + 2, fy - 2, tw * 2 - 4, 8);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + tw - 6, fy + 4);
      ctx.quadraticCurveTo(x + tw + 4, fy + 14, x + tw - 2, fy + 22); ctx.stroke();
      ctx.fillStyle = '#fffdf3'; ctx.beginPath(); ctx.arc(x + tw - 2, fy + 22, 4, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      // Lemon wedge on the rim
      ctx.save(); ctx.translate(x + tw - 6, top - 2); ctx.rotate(-0.5);
      ctx.beginPath(); ctx.arc(0, 0, 13, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#fff6b0'; ctx.fill();
      ctx.restore();
    }
    // Face
    const ey = by - hh * (pint ? 0.5 : 0.52);
    const look = Math.atan2(this.aimY, Math.abs(this.aimX) + 0.01);
    if (hurt) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      for (const ex of [x - 2, x + 15]) { ctx.beginPath(); ctx.moveTo(ex - 5, ey - 5); ctx.lineTo(ex + 5, ey + 5); ctx.moveTo(ex + 5, ey - 5); ctx.lineTo(ex - 5, ey + 5); ctx.stroke(); }
      ellipse(ctx, x + 8, ey + 18, 6, 7, '#7a1c1c', 2.5);
    } else {
      pieEye(ctx, x - 2, ey, 7, 10, look, blink);
      pieEye(ctx, x + 15, ey, 7, 10, look, blink);
      circle(ctx, x + 22, ey + 10, 4, '#ff8f8f', 0);
      ellipse(ctx, x + 9, ey + 9, 4, 3, '#c0392b', 2);
      mouth(ctx, x + 9, ey + 16, 8, this.fireCd > -0.1 ? 0.5 : 0.1);
    }
  }

  drawGhost(ctx) {
    const gx = this.x + Math.sin(this.ghostT * 3) * 20, gy = this.ghostY;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.translate(gx, gy);
    ellipse(ctx, 0, -60, 26, 8, null, 3);
    ctx.strokeStyle = '#ffe680'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, -62, 24, 7, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28, -40); ctx.quadraticCurveTo(-34, 20, -26, 30);
    for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(-20 + i * 14, 20 + (i % 2) * 12, -12 + i * 14, 30);
    ctx.quadraticCurveTo(34, 10, 28, -40); ctx.quadraticCurveTo(0, -56, -28, -40);
    ctx.fillStyle = '#d9f1ff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    pieEye(ctx, -8, -20, 5, 8, 0, true); pieEye(ctx, 10, -20, 5, 8, 0, true);
    ctx.restore();
    if (this.heartObj) {
      const h = this.heartObj;
      ctx.save(); ctx.translate(h.x, h.y); const s = 1 + Math.sin(G.time * 10) * 0.1; ctx.scale(s, s);
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-26, -4, -14, -24, 0, -10); ctx.bezierCurveTo(14, -24, 26, -4, 0, 14);
      ctx.fillStyle = PINK; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
    }
  }
}
