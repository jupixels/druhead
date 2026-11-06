// Player characters: Shotty (shot glass head) and Pint (pint glass head).
import { G, INK, PINK, clamp, rand, wob } from './core.js';
import { ellipse, circle, poly, hose, pieEye, glove, shoe, mouth, roundRect, starburst, shadePath } from './draw.js';
import { WEAPONS, Beam, Spirit } from './weapons.js';
import { play } from './audio.js';
import { rumble } from './world.js';

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
    // Visual-only animation state
    this.sq = 1; this.sqV = 0;          // squash & stretch spring
    this.headY = 0; this.headV = 0;     // head follow-through spring
    this.slosh = 0;                     // liquid tilt in the glass head
    this.recoil = 0; this.shootT = 0;
    this.runPh = 0; this.airT = 0; this.jumped = false;
    this.introT = -1; this.victoryT = -1;
    this.blinkT = 2 + Math.random() * 2; this.blink = 0;
  }

  // Visual springs, called every frame from update and from intro/KO.
  animate(dt, w) {
    const k = 320, d = 16;
    this.sqV += (k * (1 - this.sq) - d * this.sqV) * dt; this.sq += this.sqV * dt;
    this.headV += (k * (0 - this.headY) - d * this.headV) * dt; this.headY += this.headV * dt;
    const tgt = clamp(-this.vx / RUN * 0.28, -0.35, 0.35);
    this.slosh += (tgt - this.slosh) * Math.min(1, dt * 7);
    this.recoil = Math.max(0, this.recoil - dt * 14);
    this.shootT = Math.max(0, this.shootT - dt);
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blink = 0.12; this.blinkT = 2 + Math.random() * 3; }
    this.blink = Math.max(0, this.blink - dt);
    if (this.onGround) { this.airT = 0; } else this.airT += dt;
    const running = this.onGround && Math.abs(this.vx) > 10 && !this.duck;
    if (running) {
      const before = Math.sin(this.runPh);
      this.runPh += dt * 15;
      if (w && Math.sign(before) !== Math.sign(Math.sin(this.runPh))) w.dust(this.x - this.facing * 14, this.y);
    } else this.runPh = 0;
  }

  get weapon() { return WEAPONS[this.weapons[this.wIdx]]; }

  rect() {
    const h = this.duck ? 50 : this.dashT > 0 ? 60 : this.h;
    return { x: this.x - this.w / 2, y: this.y - h, w: this.w, h };
  }

  update(dt, w, inp) {
    if (this.dead) return this.updateGhost(dt, w);
    this.anim += dt;
    this.animate(dt, w);
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
      this.sq = 1.3; this.sqV = 0; this.headV = -260; this.jumped = true;
      w.dust(this.x - 12, this.y); w.dust(this.x + 12, this.y);
    } else if (inp.pressed.jump && !this.onGround && !this.parryUsed) {
      this.parryT = 0.2; this.parryUsed = true;
    }
    if (inp.released.jump && this.vy < -300 && this.jumped && this.parryFlash <= 0) this.vy *= 0.5; // variable jump height
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
        if (this.fireCd <= 0) { wp.fire(w, this, Math.atan2(this.aimY, this.aimX), this.charge >= 0.75); this.fireCd = wp.rate; this.recoil = this.charge >= 0.75 ? 2 : 1; this.shootT = 0.3; w.muzzle(this.mx, this.my, this.weapons[this.wIdx]); }
        this.charge = 0;
      }
    } else if (inp.held.shoot && this.fireCd <= 0) {
      wp.fire(w, this, Math.atan2(this.aimY, this.aimX));
      this.fireCd = wp.rate;
      this.recoil = 1; this.shootT = 0.3;
      w.muzzle(this.mx, this.my, this.weapons[this.wIdx]);
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
      this.sq = 0.68; this.sqV = 0; this.headV = 300; this.jumped = false;
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
    rumble(0.7, 220, this.idx);
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
  pose() {
    if (this.victoryT >= 0) return 'victory';
    if (this.introT >= 0) return 'intro';
    if (this.superT > 0) return 'super';
    if (this.hurtT > 0) return 'hurt';
    if (this.dashT > 0) return 'dash';
    if (this.exT > 0) return 'ex';
    if (!this.onGround) return this.jumped && this.shootT <= 0 && !this.lock ? 'ball' : 'air';
    if (this.duck) return 'duck';
    if (Math.abs(this.vx) > 10) return 'run';
    return 'idle';
  }

  draw(ctx) {
    if (this.dead) return this.drawGhost(ctx);
    const flick = this.invuln > 0 && this.courage <= 0 && this.superT <= 0 && this.introT < 0 && this.victoryT < 0 && Math.floor(this.invuln * 18) % 2 === 0;
    const pose = this.pose();
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.onGround) { ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(0, 0, 28 * (pose === 'duck' ? 1.2 : 1), 6, 0, 0, 7); ctx.fill(); }
    if (this.courage > 0) {
      ctx.save(); ctx.globalAlpha = 0.4 + Math.sin(G.time * 20) * 0.15;
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(0, -62, 58, 84, 0, 0, 7); ctx.fill(); ctx.restore();
    }
    ctx.scale(this.facing * 1.1, 1.1);
    if (pose === 'dash') {
      for (let i = 3; i >= 1; i--) {
        ctx.save(); ctx.globalAlpha = 0.16 * (4 - i); ctx.translate(-i * 26, 0);
        this.drawFigure(ctx, pose, true); ctx.restore();
      }
    }
    if (flick) ctx.globalAlpha = 0.3;
    this.drawFigure(ctx, pose, false);
    ctx.restore();
    // Curved motion arcs around the jump ball
    if (pose === 'ball') {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      const a = this.airT * 17 * this.facing;
      for (const o of [0, Math.PI]) { ctx.beginPath(); ctx.arc(this.x, this.y - 48, 46, a + o, a + o + 0.9); ctx.stroke(); }
      ctx.restore();
    }
    if (this.parryFlash > 0) {
      const k = this.parryFlash / 0.25;
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = PINK; ctx.lineWidth = 6 * k;
      ctx.beginPath(); ctx.arc(this.x, this.y - 50, 70 * (1.4 - k), 0, 7); ctx.stroke(); ctx.restore();
    }
  }

  // Draws the character in local space (feet at 0,0, facing +x).
  drawFigure(ctx, pose, silhouette) {
    const c = this.char;
    const lax = this.aimX * this.facing, lay = this.aimY;
    const t = this.anim, ph = this.runPh;
    let lean = 0, bob = 0, hop = 0;
    let f1x = -9, f1y = 0, f2x = 9, f2y = 0, hipY = -30;
    let expr = this.shootT > 0 || this.lock ? 'focus' : 'normal';
    let backHand = null, frontHand = null, armsUp = false;
    const shake = pose === 'super' ? Math.sin(G.time * 70) * 2 : 0;
    switch (pose) {
      case 'idle': bob = Math.sin(t * 3.4) * 1.6; break;
      case 'run':
        lean = 0.15; bob = -Math.abs(Math.sin(ph)) * 7;
        f1x = Math.sin(ph) * 19; f1y = -Math.max(0, Math.cos(ph)) * 13;
        f2x = -Math.sin(ph) * 19; f2y = -Math.max(0, -Math.cos(ph)) * 13;
        break;
      case 'duck': hipY = -12; f1x = -19; f2x = 19; lean = 0.12; break;
      case 'air': f1x = -14; f1y = -24; f2x = 12; f2y = -12; lean = -0.05; break;
      case 'dash': lean = 0.45; f1x = -34; f1y = -16; f2x = -22; f2y = -4; expr = 'focus'; backHand = [-30, -44]; break;
      case 'hurt': lean = -0.35; f1x = -20; f1y = -10; f2x = 18; f2y = -4; expr = 'hurt'; armsUp = true; break;
      case 'ex': lean = -0.22; f1x = -18; f2x = 14; expr = 'strain'; break;
      case 'super': lean = -0.1; f1x = -22; f2x = 20; expr = 'strain'; break;
      case 'intro': {
        const k = this.introT;
        if (k < 0.45) { this.sq = 1 - Math.sin(k / 0.45 * Math.PI) * 0.2; }
        else if (k < 0.95) { hop = -Math.sin((k - 0.45) / 0.5 * Math.PI) * 46; f1y = -14; f2y = -8; armsUp = true; expr = 'happy'; }
        else { expr = 'focus'; bob = Math.sin(t * 3.4) * 1.6; }
        break;
      }
      case 'victory': {
        hop = -Math.abs(Math.sin(this.victoryT * 6)) * 34; armsUp = true; expr = 'happy';
        if (hop < -4) { f1y = -14; f2y = -10; }
        break;
      }
    }
    if (pose === 'ball') return this.drawBall(ctx, c);
    ctx.translate(shake, hop);
    ctx.rotate(lean);
    const sq = this.sq * (pose === 'dash' ? 0.88 : 1);
    ctx.scale((pose === 'dash' ? 1.18 : 1) / Math.sqrt(sq), sq);
    const duck = pose === 'duck';
    const ink = silhouette ? '#fff' : null;
    hipY += bob;
    const shY = (duck ? -32 : -57) + bob;
    // Back arm
    let bx, by;
    if (armsUp) { bx = -32 + Math.sin(t * 18) * 4; by = shY - 38; }
    else if (backHand) { [bx, by] = backHand; }
    else { const sw = pose === 'run' ? Math.sin(ph + Math.PI) * 16 : Math.sin(t * 3.4) * 2; bx = -14 + sw; by = shY + 24; }
    hose(ctx, -6, shY, (bx - 6) / 2 - 6, (shY + by) / 2 + 4, bx, by, 7, ink || '#fff');
    if (!silhouette) glove(ctx, bx, by + 2, 9.5, armsUp ? -1.6 : 0);
    // Legs (rubber hose, slight knee curve)
    const leg = (fx, fy, side) => {
      hose(ctx, side * 6, hipY, side * 6 + (fx - side * 6) * 0.5 + 6, (hipY + fy) / 2, fx, fy - 6, 7, INK);
      if (!silhouette) shoe(ctx, fx, fy, 1, c.shoe, 1.1);
    };
    leg(f1x, f1y, -1);
    // Torso
    const ty = (duck ? -24 : -46) + bob;
    const trx = 19, try_ = duck ? 14 : 20;
    if (silhouette) { ellipse(ctx, 0, ty, trx, try_, '#fff', 0); }
    else {
      ellipse(ctx, 0, ty, trx, try_, '#fbf6ea', 0);
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, ty, trx, try_, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = c.shorts; ctx.fillRect(-24, ty + 1, 48, 30);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-24, ty + 1, 48, 3);
      ctx.restore();
      ctx.beginPath(); ctx.ellipse(0, ty, trx, try_, 0, 0, Math.PI * 2); shadePath(ctx, 0, ty, try_, 1.1);
      ellipse(ctx, 0, ty, trx, try_, null, 3);
      circle(ctx, -7, ty + 7, 2.5, '#fff', 1.5); circle(ctx, 7, ty + 7, 2.5, '#fff', 1.5);
    }
    leg(f2x, f2y, 1);
    // Head
    const hy = (duck ? -40 : -67) + bob + this.headY * 0.06 + (pose === 'run' ? Math.abs(Math.sin(ph - 0.6)) * -2 : 0);
    if (silhouette) { ellipse(ctx, 2, hy - 30, 30, 32, '#fff', 0); }
    else this.drawHead(ctx, 2, hy, expr, lean);
    // Front (aiming) arm with recoil
    let hx, hyy, point = true;
    if (this.parryT > 0 || this.parryFlash > 0) { hx = 16; hyy = shY - 36; point = false; }
    else if (armsUp && pose !== 'hurt') { hx = 36 + Math.sin(t * 18 + 1) * 4; hyy = shY - 40; point = false; }
    else if (pose === 'hurt') { hx = 20; hyy = shY - 30; point = false; }
    else {
      const reach = pose === 'ex' || pose === 'super' ? 36 : 30;
      const rc = this.recoil * 7;
      hx = 8 + lax * (reach - rc); hyy = shY + 2 + lay * (reach - rc);
    }
    hose(ctx, 6, shY, (6 + hx) / 2 + 4, (shY + hyy) / 2 + 6, hx, hyy, 7, ink || '#fff');
    if (!silhouette) {
      if (pose === 'super') { glove(ctx, hx, hyy, 10, Math.atan2(lay, lax), false); glove(ctx, hx - 6, hyy + 6, 10, Math.atan2(lay, lax), false); }
      else glove(ctx, hx, hyy, 10.5, point ? Math.atan2(lay, lax) : -1.4, point);
      if (this.parryFlash > 0) circle(ctx, hx, hyy, 10 + 18 * (this.parryFlash / 0.25), 'rgba(255,95,168,.55)', 0);
      if (this.charge > 0.15 && this.weapon.charge) {
        const k = Math.min(1, this.charge / 0.75);
        const cx = hx + lax * 16, cy = hyy + lay * 16;
        ctx.fillStyle = k >= 1 ? (Math.floor(G.time * 20) % 2 ? '#e6ff9a' : '#9cff4a') : 'rgba(180,255,120,.55)';
        ctx.beginPath(); ctx.arc(cx, cy, 4 + k * 15, 0, 7); ctx.fill();
        if (k >= 1) starburst(ctx, cx, cy, 26, 6, 'rgba(230,255,154,.6)', G.time * 6, 0);
      }
    }
  }

  drawBall(ctx, c) {
    const spin = this.airT * 17;
    ctx.translate(0, -48);
    ctx.rotate(spin);
    const s = 1 / Math.sqrt(this.sq);
    ctx.scale(s, this.sq);
    // Tucked limbs
    shoe(ctx, -14, 26, 1, c.shoe, 0.9); shoe(ctx, 12, 24, -1, c.shoe, 0.9);
    ellipse(ctx, 0, 8, 22, 20, '#fbf6ea', 0);
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 8, 22, 20, 0, 0, 7); ctx.clip(); ctx.fillStyle = c.shorts; ctx.fillRect(-24, 10, 48, 24); ctx.restore();
    ellipse(ctx, 0, 8, 22, 20, null, 3);
    glove(ctx, -20, 4, 8); glove(ctx, 22, 6, 8);
    ctx.save(); ctx.translate(0, 10); ctx.scale(0.82, 0.82);
    this.drawHead(ctx, 0, -10, 'focus', 0);
    ctx.restore();
  }

  drawHead(ctx, x, by, expr = 'normal', lean = 0) {
    const pint = this.char.head === 'pint';
    const tw = pint ? 30 : 31, bw = pint ? 23 : 21, hh = pint ? 66 : 54;
    const top = by - hh;
    // Glass body
    const glassPts = [[x - tw, top], [x + tw, top], [x + bw, by], [x - bw, by]];
    poly(ctx, glassPts, 'rgba(228,242,250,.96)', 0);
    // Liquid with slosh (tilts against motion)
    const lt = top + (pint ? 14 : 10);
    const wAt = (y) => tw + (bw - tw) * ((y - top) / hh);
    const tilt = this.slosh * 14 - lean * 10;
    const lw = wAt(lt) - 2;
    ctx.beginPath();
    ctx.moveTo(x - lw, lt + tilt);
    for (let i = 1; i <= 8; i++) { const k = i / 8; ctx.lineTo(x - lw + k * lw * 2, lt + tilt * (1 - 2 * k) + Math.sin(G.time * 7 + i * 1.3) * 1.4); }
    ctx.lineTo(x + bw - 2, by - (pint ? 4 : 9)); ctx.lineTo(x - bw + 2, by - (pint ? 4 : 9)); ctx.closePath();
    ctx.fillStyle = pint ? '#eaa836' : '#c9762a'; ctx.fill();
    // Inner shade on the liquid
    ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(120,50,0,.18)'; ctx.fillRect(x + bw * 0.3, top, tw, hh); ctx.restore();
    if (!pint) { ctx.fillStyle = 'rgba(205,228,242,.97)'; ctx.fillRect(x - bw + 1, by - 9, bw * 2 - 2, 8); }
    if (pint) for (let i = 0; i < 5; i++) circle(ctx, x - 14 + i * 7, by - 8 - ((G.time * 42 + i * 13) % 40), 1.7, '#fff3c4', 0);
    poly(ctx, glassPts, null, 3.5, 7);
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - tw + 7, top + 10); ctx.lineTo(x - bw + 6, by - 14); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - tw + 14, top + 12); ctx.lineTo(x - bw + 12, top + 26); ctx.stroke();
    ellipse(ctx, x, top, tw, 6, 'rgba(242,250,255,.97)', 3);
    if (pint) {
      const fy = top - 2;
      for (let i = 0; i < 6; i++) circle(ctx, x - tw + 4 + i * 10.5, fy - 4 + Math.sin(i * 2.1 + G.time * 2) * 2.5 + wob(i + 3, 0.8), 9, '#fffdf3', 2.5);
      ctx.fillStyle = '#fffdf3'; ctx.fillRect(x - tw + 2, fy - 2, tw * 2 - 4, 8);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x + tw - 6, fy + 4);
      const drip = 18 + Math.sin(G.time * 1.5) * 5;
      ctx.quadraticCurveTo(x + tw + 4, fy + 12, x + tw - 2, fy + drip); ctx.stroke();
      ctx.fillStyle = '#fffdf3'; ctx.beginPath(); ctx.arc(x + tw - 2, fy + drip, 4, 0, 7); ctx.fill(); ctx.stroke();
    } else {
      ctx.save(); ctx.translate(x + tw - 6, top - 2); ctx.rotate(-0.5 + Math.sin(G.time * 3) * 0.05 + this.slosh * 0.6);
      ctx.beginPath(); ctx.arc(0, 0, 13, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#fff6b0'; ctx.fill();
      ctx.strokeStyle = 'rgba(200,170,40,.8)'; ctx.lineWidth = 1.5; for (let i = 1; i < 4; i++) { const a = Math.PI + i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.stroke(); }
      ctx.restore();
    }
    // Face
    const ey = by - hh * (pint ? 0.5 : 0.52);
    const look = Math.atan2(this.aimY, Math.abs(this.aimX) + 0.01);
    const e1 = x - 2, e2 = x + 15;
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    if (expr === 'hurt') {
      ellipse(ctx, e1, ey - 1, 8, 12, '#fff', 2.5); ellipse(ctx, e2, ey - 1, 8, 12, '#fff', 2.5);
      circle(ctx, e1 + 1, ey, 2.5, INK, 0); circle(ctx, e2 + 1, ey, 2.5, INK, 0);
      ellipse(ctx, x + 8, ey + 19, 6, 8, '#5a1010', 2.5);
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e1 - 6, ey - 17); ctx.lineTo(e1 + 5, ey - 14); ctx.moveTo(e2 + 6, ey - 17); ctx.lineTo(e2 - 5, ey - 14); ctx.stroke();
    } else if (expr === 'happy') {
      ctx.lineWidth = 3.5;
      for (const ex of [e1, e2]) { ctx.beginPath(); ctx.arc(ex, ey + 3, 6, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      circle(ctx, x + 22, ey + 9, 4.5, '#ff8f8f', 0);
      ellipse(ctx, x + 9, ey + 9, 4, 3, '#c0392b', 2);
      ctx.beginPath(); ctx.moveTo(x - 1, ey + 14); ctx.quadraticCurveTo(x + 9, ey + 30, x + 19, ey + 14); ctx.closePath(); ctx.fillStyle = '#7a1c1c'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    } else {
      const blink = this.blink > 0;
      const squint = expr === 'strain';
      pieEye(ctx, e1, ey, 7, squint ? 6 : 10, look, blink);
      pieEye(ctx, e2, ey, 7, squint ? 6 : 10, look, blink);
      if (expr === 'focus' || squint) {
        ctx.lineWidth = 3.5; ctx.beginPath();
        ctx.moveTo(e1 - 7, ey - 14); ctx.lineTo(e1 + 5, ey - 9); ctx.moveTo(e2 + 7, ey - 14); ctx.lineTo(e2 - 5, ey - 9); ctx.stroke();
      }
      circle(ctx, x + 22, ey + 10, 4, '#ff8f8f', 0);
      ellipse(ctx, x + 9, ey + 9, 4, 3, '#c0392b', 2);
      if (squint) { ellipse(ctx, x + 9, ey + 20, 9, 7, '#5a1010', 3); }
      else if (expr === 'focus') {
        roundRect(ctx, x + 1, ey + 13, 16, 7, 3, '#fff', 2.5);
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 9, ey + 13); ctx.lineTo(x + 9, ey + 20); ctx.stroke();
      } else mouth(ctx, x + 9, ey + 16, 8, 0.15);
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
