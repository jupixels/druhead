// Title screen, save slots, player count, options and controls.
import { G, W, H, INK } from '../core.js';
import { panel, text, roundRect, circle, ellipse, FONT_TITLE, FONT_UI } from '../draw.js';
import { Menu } from '../ui.js';
import { menu, binds, saveBinds, resetBinds, takeLastKey, keyName } from '../input.js';
import { iris } from '../fx.js';
import { playMusic, play, applyVolume } from '../audio.js';
import { loadSlot, newSave, writeSave, deleteSlot, saveSettings, completion, iouCount } from '../save.js';
import { Player } from '../player.js';
import { nav } from './nav.js';

export class TitleScene {
  constructor() {
    this.t = 0;
    this.mode = 'main';
    this.dancers = [new Player(0, 290, 612, { weapons: ['beer'] }), new Player(1, 990, 612, { weapons: ['beer'] })];
    this.dancers.forEach((d, i) => { d.onGround = true; d.facing = i ? -1 : 1; });
    this.main = new Menu([
      { label: 'Start', action: () => this.openSlots() },
      { label: 'Options', action: () => this.openOptions() },
      { label: 'Controls', action: () => (this.mode = 'controls', this.ctlSel = 0) },
    ], { back: () => (this.mode = 'press') });
    this.confirmDelete = -1;
  }
  enter() { playMusic('title'); }

  openSlots() {
    this.mode = 'slots';
    const items = [0, 1, 2].map((i) => ({
      label: () => {
        const s = loadSlot(i);
        if (!s) return `Slot ${i + 1} — New Game`;
        return `Slot ${i + 1} — ${completion(s)}%  ·  ${iouCount(s)} IOUs  ·  ${s.coins} coins`;
      },
      action: () => this.pickSlot(i),
    }));
    items.push({ label: 'Delete a Slot', action: () => (this.mode = 'delete', this.delMenu.i = 0) });
    this.slots = new Menu(items, { back: () => (this.mode = 'main') });
    this.delMenu = new Menu([0, 1, 2].map((i) => ({ label: `Delete Slot ${i + 1}`, action: () => { deleteSlot(i); play('glass_shatter'); this.openSlots(); } })), { back: () => this.openSlots() });
  }
  pickSlot(i) {
    G.slot = i;
    G.save = loadSlot(i) || newSave();
    writeSave();
    this.mode = 'players';
    this.players = new Menu([
      { label: '1 Player', action: () => this.go(false) },
      { label: '2 Players (one keyboard)', action: () => this.go(true) },
    ], { back: () => this.openSlots() });
  }
  go(coop) {
    G.coop = coop;
    iris.close(() => {
      if (!G.save.storySeen) { G.save.storySeen = true; writeSave(); nav.story(() => nav.map()); }
      else nav.map();
    });
  }
  openOptions() {
    this.mode = 'options';
    const st = G.settings;
    const pct = (v) => `${Math.round(v * 10) * 10}%`;
    const adj = (k, d) => { st[k] = Math.max(0, Math.min(1, Math.round((st[k] + d) * 10) / 10)); applyVolume(); saveSettings(); };
    this.opts = new Menu([
      { label: () => `Sound Volume: ${pct(st.volume)}`, left: () => adj('volume', -0.1), right: () => adj('volume', 0.1), action: () => adj('volume', st.volume >= 1 ? -1 : 0.1) },
      { label: () => `Music Volume: ${pct(st.music)}`, left: () => adj('music', -0.1), right: () => adj('music', 0.1), action: () => adj('music', st.music >= 1 ? -1 : 0.1) },
      { label: () => `Old Film Effect: ${st.filter ? 'On' : 'Off'}`, action: () => { st.filter = !st.filter; applyCanvasFilter(); saveSettings(); } },
      { label: () => `Screen Shake: ${st.shake ? 'On' : 'Off'}`, action: () => { st.shake = !st.shake; saveSettings(); } },
      { label: () => `Black & White Mode: ${st.bw ? 'On' : 'Off'}${anyBw() ? '' : ' (locked)'}`, disabled: false, action: () => { if (!anyBw()) { play('menu_back'); return; } st.bw = !st.bw; applyCanvasFilter(); saveSettings(); } },
      { label: 'Back', action: () => (this.mode = 'main') },
    ], { back: () => (this.mode = 'main') });
  }

  update(dt) {
    this.t += dt;
    this.dancers.forEach((d, i) => { d.anim += dt; d.vx = 0; d.danceT = this.t + i * 0.6; d.aimX = d.facing; d.aimY = 0; d.animate(dt, null); });
    if (iris.busy()) return;
    if (this.mode === 'press') { if (menu.any) { this.mode = 'main'; play('menu_select'); } return; }
    if (this.mode === 'main') this.main.update();
    else if (this.mode === 'slots') this.slots.update();
    else if (this.mode === 'delete') this.delMenu.update();
    else if (this.mode === 'players') this.players.update();
    else if (this.mode === 'options') this.opts.update();
    else if (this.mode === 'controls') this.updateControls();
  }

  updateControls() {
    const acts = ['up', 'down', 'left', 'right', 'jump', 'shoot', 'dash', 'ex', 'swap', 'lock'];
    const n = acts.length * 2 + 1;
    if (this.waiting) {
      const k = takeLastKey();
      if (k) {
        if (k !== 'Escape') { const [side, act] = this.waiting; binds[side][act] = k; saveBinds(); play('menu_select'); }
        this.waiting = null;
      }
      return;
    }
    if (menu.back) { this.mode = 'main'; play('menu_back'); return; }
    if (menu.up) { this.ctlSel = (this.ctlSel - 1 + n) % n; play('menu_move'); }
    if (menu.down) { this.ctlSel = (this.ctlSel + 1) % n; play('menu_move'); }
    if (menu.left || menu.right) { if (this.ctlSel < n - 1) { this.ctlSel = (this.ctlSel + acts.length) % (acts.length * 2); play('menu_move'); } }
    if (menu.confirm) {
      if (this.ctlSel === n - 1) { resetBinds(); play('menu_select'); return; }
      const side = this.ctlSel < acts.length ? 'left' : 'right';
      this.waiting = [side, acts[this.ctlSel % acts.length]];
      takeLastKey();
    }
  }

  draw(ctx) {
    const t = this.t;
    // Rotating sunburst
    ctx.fillStyle = '#7a1c0c'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, 330); ctx.rotate(t * 0.08);
    for (let i = 0; i < 28; i++) { ctx.fillStyle = i % 2 ? '#c8461c' : '#e0682a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1100, (i / 28) * 6.283, ((i + 1) / 28) * 6.283); ctx.fill(); }
    ctx.restore();
    const glow = ctx.createRadialGradient(W / 2, 330, 40, W / 2, 330, 620);
    glow.addColorStop(0, 'rgba(255,230,150,.55)'); glow.addColorStop(1, 'rgba(60,10,0,.55)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    // Stage floor with footlights
    ctx.fillStyle = '#5a2e12'; ctx.fillRect(0, 610, W, 110);
    ctx.fillStyle = '#7a4420'; ctx.fillRect(0, 610, W, 14);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 610); ctx.lineTo(W, 610); ctx.stroke();
    for (let x = 80; x < W; x += 140) { const on = Math.floor(t * 3 + x) % 5 !== 0; ctx.fillStyle = on ? '#ffe680' : '#b08a40'; ctx.beginPath(); ctx.arc(x, 690, 18, Math.PI, 0); ctx.fill(); ctx.lineWidth = 3; ctx.stroke(); }
    // Curtains (draped, swaying)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const base = side < 0 ? i * 30 - 10 : W - i * 30 + 10;
        ctx.fillStyle = i % 2 ? '#8a1414' : '#a81e1e';
        const sway = Math.sin(t * 0.8 + i * 0.6) * 6;
        ctx.beginPath(); ctx.moveTo(base, -10);
        ctx.quadraticCurveTo(base - side * 50 + sway, 380, base - side * (i < 3 ? 30 : 0) + sway, H + 10);
        ctx.lineTo(base - side * 60, H + 10); ctx.lineTo(base - side * 60, -10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    ctx.fillStyle = '#a81e1e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 50);
    for (let x = W; x >= 0; x -= 106) ctx.quadraticCurveTo(x - 53, 120, x - 106, 50);
    ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#d9a93a'; for (let x = 53; x < W; x += 106) { ctx.beginPath(); ctx.arc(x, 92, 8, 0, 7); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
    // Spotlights on the dancers
    for (const d of this.dancers) { const g = ctx.createRadialGradient(d.x, 600, 10, d.x, 600, 200); g.addColorStop(0, 'rgba(255,245,200,.45)'); g.addColorStop(1, 'rgba(255,245,200,0)'); ctx.fillStyle = g; ctx.fillRect(d.x - 220, 380, 440, 260); }
    // Dancers (big)
    for (const d of this.dancers) { ctx.save(); ctx.translate(d.x, d.y); ctx.scale(1.85, 1.85); ctx.translate(-d.x, -d.y); d.draw(ctx); ctx.restore(); }
    // Logo on an arc
    this.drawLogo(ctx, W / 2, 210, t);
    // Ribbon banner
    ctx.save(); ctx.translate(W / 2, 300);
    ctx.fillStyle = '#e8d29a'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 230, -18); ctx.lineTo(sd * 290, -22); ctx.lineTo(sd * 270, 0); ctx.lineTo(sd * 290, 22); ctx.lineTo(sd * 230, 18); ctx.closePath(); ctx.fillStyle = '#c9b07a'; ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-240, -22); ctx.quadraticCurveTo(0, -34, 240, -22); ctx.lineTo(240, 22); ctx.quadraticCurveTo(0, 10, -240, 22); ctx.closePath(); ctx.fillStyle = '#f3e6c4'; ctx.fill(); ctx.stroke();
    text(ctx, 'A RUN & GUN SALOON BRAWL', 0, -6, 24, '#7a1c1c', 'center', FONT_TITLE, 0);
    ctx.restore();

    if (this.mode === 'press') {
      const a = 0.6 + Math.sin(t * 4) * 0.4;
      ctx.globalAlpha = a; text(ctx, 'PRESS ANY KEY', W / 2, 410, 40, '#fff6d8', 'center', FONT_TITLE, 8); ctx.globalAlpha = 1;
    } else if (this.mode === 'main') {
      this.plaque(ctx, W / 2 - 170, 345, 340, 205);
      this.main.draw(ctx, W / 2, 392, 34, 54);
    } else if (this.mode === 'slots' || this.mode === 'delete') {
      this.plaque(ctx, W / 2 - 380, 330, 760, 290);
      text(ctx, this.mode === 'slots' ? 'Choose a Save Slot' : 'Delete which slot?', W / 2, 372, 30, '#7a1c1c', 'center', FONT_TITLE, 0);
      (this.mode === 'slots' ? this.slots : this.delMenu).draw(ctx, W / 2, 425, 25, 46);
    } else if (this.mode === 'players') {
      this.plaque(ctx, W / 2 - 320, 340, 640, 240);
      text(ctx, 'How many drinkers?', W / 2, 382, 32, '#7a1c1c', 'center', FONT_TITLE, 0);
      this.players.draw(ctx, W / 2, 440, 30, 52);
      text(ctx, 'Player 1: left side of the keyboard  ·  Player 2: right side', W / 2, 545, 18, INK, 'center', FONT_UI, 0);
    } else if (this.mode === 'options') {
      this.plaque(ctx, W / 2 - 340, 320, 680, 380);
      text(ctx, 'Options', W / 2, 360, 34, '#7a1c1c', 'center', FONT_TITLE, 0);
      this.opts.draw(ctx, W / 2, 412, 26, 46);
      text(ctx, '←/→ to adjust', W / 2, 678, 16, INK, 'center', FONT_UI, 0);
    } else if (this.mode === 'controls') this.drawControls(ctx);
    text(ctx, 'v1.0', W - 24, H - 18, 14, 'rgba(255,240,210,.6)', 'right', FONT_UI, 0);
  }

  drawLogo(ctx, cx, cy, t) {
    const word = 'DRUNKHEAD';
    ctx.font = `124px ${FONT_TITLE}`;
    const widths = [...word].map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0);
    const R = 1400;
    let acc = -total / 2;
    for (let i = 0; i < word.length; i++) {
      const cw = widths[i];
      const mid = acc + cw / 2; acc += cw;
      const ang = mid / R;
      const x = cx + Math.sin(ang) * R, y = cy - Math.cos(ang) * R + R + Math.sin(t * 3 + i * 0.7) * 6;
      const sq = 1 + Math.sin(t * 6 + i) * 0.03;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(sq, 1 / sq);
      text(ctx, word[i], 6, 10, 124, '#3b0d06', 'center', FONT_TITLE, 0);
      text(ctx, word[i], 0, 0, 124, '#fff0c0', 'center', FONT_TITLE, 14);
      ctx.save(); ctx.beginPath(); ctx.rect(-cw, 0, cw * 2, 80); ctx.clip();
      text(ctx, word[i], 0, 0, 124, '#ffc84a', 'center', FONT_TITLE, 0);
      ctx.restore();
      ctx.restore();
    }
  }

  plaque(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.roundRect(x + 10, y + 12, w, h, 18); ctx.fill();
    ctx.fillStyle = '#7a4420'; ctx.beginPath(); ctx.roundRect(x - 10, y - 10, w + 20, h + 20, 22); ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = '#f3e6c4'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    for (const [px, py] of [[x + 4, y + 4], [x + w - 4, y + 4], [x + 4, y + h - 4], [x + w - 4, y + h - 4]]) circle(ctx, px, py, 7, '#d9a93a', 2.5);
    ctx.restore();
  }

  drawControls(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
    panel(ctx, 140, 40, 1000, 640);
    text(ctx, 'Controls', W / 2, 85, 40, '#c0392b', 'center', FONT_TITLE, 0);
    text(ctx, 'Player 1 (left side)', 400, 130, 24, INK, 'center', FONT_TITLE, 0);
    text(ctx, 'Player 2 (right side)', 880, 130, 24, INK, 'center', FONT_TITLE, 0);
    const acts = ['up', 'down', 'left', 'right', 'jump', 'shoot', 'dash', 'ex', 'swap', 'lock'];
    const names = { up: 'Up / Aim Up', down: 'Down / Duck', left: 'Left', right: 'Right', jump: 'Jump / Parry', shoot: 'Shoot', dash: 'Dash', ex: 'EX / Super', swap: 'Swap Weapon', lock: 'Lock (aim in place)' };
    acts.forEach((a, i) => {
      const y = 170 + i * 40;
      for (const [k, side] of [[0, 'left'], [1, 'right']]) {
        const sel = this.ctlSel === k * acts.length + i;
        const bx = k ? 660 : 180;
        if (sel) roundRect(ctx, bx - 10, y - 17, 440, 34, 6, this.waiting ? '#ffd86a' : '#f0c8a0', 0);
        text(ctx, names[a], bx, y, 20, INK, 'left', FONT_UI, 0);
        const label = sel && this.waiting ? 'press a key…' : keyName(binds[side][a]);
        text(ctx, label, bx + 410, y, 20, '#7a1c1c', 'right', FONT_UI, 0);
      }
    });
    const rs = this.ctlSel === acts.length * 2;
    text(ctx, 'Reset to Defaults', W / 2, 590, 24, rs ? '#c0392b' : INK, 'center', FONT_TITLE, 0);
    text(ctx, 'Jump to rebind  ·  ←/→ switch player  ·  Esc back  ·  Gamepads: A jump, X shoot, Y EX, RB dash, LB swap, LT lock', W / 2, 640, 16, INK, 'center', FONT_UI, 0);
    text(ctx, 'Single player can use either side. Space also jumps. Esc / P pauses. M mutes.', W / 2, 662, 16, INK, 'center', FONT_UI, 0);
  }
}

function anyBw() { for (let i = 0; i < 3; i++) { const s = loadSlot(i); if (s && s.bwUnlocked) return true; } return false; }
export function applyCanvasFilter() {
  const c = G.canvas;
  c.classList.toggle('bw', !!G.settings.bw);
  c.classList.toggle('nofilter', !G.settings.filter && !G.settings.bw);
}
