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
    this.mode = 'press';
    this.dancers = [new Player(0, 470, 600, { weapons: ['beer'] }), new Player(1, 810, 600, { weapons: ['beer'] })];
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
    this.dancers.forEach((d, i) => { d.anim += dt; d.vx = Math.sin(this.t * 2 + i * 3) * 30; d.aimX = d.facing; d.aimY = 0; d.fireCd = Math.sin(this.t * 8) > 0 ? 0 : -1; });
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
    // Stage with curtains
    ctx.fillStyle = '#2a0d08'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, 380, 50, W / 2, 380, 560);
    g.addColorStop(0, '#f6d78a'); g.addColorStop(1, '#5a2a10');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const x = side < 0 ? i * 34 : W - i * 34;
        ctx.fillStyle = i % 2 ? '#8a1a14' : '#a8241a';
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + side * -30 + Math.sin(this.t + i) * 4, H / 2, x + side * 20, H); ctx.lineTo(x - side * 40, H); ctx.lineTo(x - side * 40, 0); ctx.fill();
      }
    }
    ctx.fillStyle = '#8a1a14'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 60);
    for (let x = W; x >= 0; x -= 80) ctx.quadraticCurveTo(x - 40, 110, x - 80, 60);
    ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    // Stage floor
    ctx.fillStyle = '#6b3a1a'; ctx.fillRect(0, 600, W, 120);
    ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 600); ctx.lineTo(W, 600); ctx.stroke();
    // Dancers
    for (const d of this.dancers) d.draw(ctx);

    // Logo
    const word = 'DRUNKHEAD';
    ctx.save(); ctx.translate(W / 2, 175);
    ctx.font = `128px ${FONT_TITLE}`;
    const total = ctx.measureText(word).width;
    let x = -total / 2;
    for (let i = 0; i < word.length; i++) {
      const ch = word[i]; const cw = ctx.measureText(ch).width;
      const y = Math.sin(this.t * 3 + i * 0.6) * 8;
      ctx.save(); ctx.translate(x + cw / 2, y); ctx.rotate(Math.sin(this.t * 2 + i) * 0.04);
      text(ctx, ch, 0, 6, 128, '#3b0d06', 'center', FONT_TITLE, 0);
      text(ctx, ch, 0, 0, 128, i % 2 ? '#ffd86a' : '#ffe9a8', 'center', FONT_TITLE, 10);
      ctx.restore();
      x += cw;
    }
    ctx.restore();
    text(ctx, 'A Run & Gun Saloon Brawl', W / 2, 270, 30, '#fff3d0', 'center', FONT_UI, 6);

    if (this.mode === 'press') {
      if (Math.floor(this.t * 2) % 2) text(ctx, 'PRESS ANY KEY', W / 2, 400, 40, '#fff', 'center', FONT_TITLE, 8);
    } else if (this.mode === 'main') {
      panel(ctx, W / 2 - 170, 320, 340, 210);
      this.main.draw(ctx, W / 2, 370, 36, 56);
    } else if (this.mode === 'slots' || this.mode === 'delete') {
      panel(ctx, W / 2 - 360, 300, 720, 290);
      text(ctx, this.mode === 'slots' ? 'Choose a Save Slot' : 'Delete which slot?', W / 2, 340, 30, '#c0392b', 'center', FONT_TITLE, 0);
      (this.mode === 'slots' ? this.slots : this.delMenu).draw(ctx, W / 2, 395, 26, 46);
    } else if (this.mode === 'players') {
      panel(ctx, W / 2 - 300, 320, 600, 230);
      text(ctx, 'How many drinkers?', W / 2, 360, 32, '#c0392b', 'center', FONT_TITLE, 0);
      this.players.draw(ctx, W / 2, 420, 30, 52);
      text(ctx, 'Player 1: left side of keyboard  ·  Player 2: right side', W / 2, 520, 18, INK, 'center', FONT_UI, 0);
    } else if (this.mode === 'options') {
      panel(ctx, W / 2 - 330, 300, 660, 380);
      text(ctx, 'Options', W / 2, 340, 34, '#c0392b', 'center', FONT_TITLE, 0);
      this.opts.draw(ctx, W / 2, 395, 26, 46);
      text(ctx, '←/→ to adjust', W / 2, 655, 16, INK, 'center', FONT_UI, 0);
    } else if (this.mode === 'controls') this.drawControls(ctx);
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
