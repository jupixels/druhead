// Results card after winning a level.
import { G, W, H, INK } from '../core.js';
import { panel, text, roundRect, starburst, FONT_TITLE, FONT_UI } from '../draw.js';
import { LEVELS, betterGrade } from '../levels.js';
import { DIFFS } from '../world.js';
import { menu } from '../input.js';
import { iris } from '../fx.js';
import { play, playMusic } from '../audio.js';
import { writeSave } from '../save.js';
import { nav } from './nav.js';
import { Player } from '../player.js';

export class ResultsScene {
  constructor(id, diff, res) {
    this.id = id; this.diff = diff; this.res = res; this.t = 0;
    this.def = LEVELS[id];
    const s = G.save;
    const prev = s.beaten[id];
    this.firstClear = !prev;
    s.beaten[id] = { grade: betterGrade(prev && prev.grade, res.grade), diff: Math.max(prev ? prev.diff : 0, diff) };
    this.newIou = false;
    if (this.def.type === 'boss' || this.def.type === 'plane') {
      if (diff >= 1 && !s.iou[id]) { s.iou[id] = true; this.newIou = true; }
    }
    this.bonus = 0;
    if (this.firstClear && (this.def.type === 'boss' || this.def.type === 'plane' || this.def.type === 'parry')) { this.bonus = 2; s.coins += 2; }
    for (const c of res.coinIds || []) if (!s.coinsFound[c]) { s.coinsFound[c] = true; s.coins++; }
    if (this.def.onWin) this.def.onWin(s, diff);
    if (s.iou.tab) s.bwUnlocked = true;
    writeSave();
    this.stamped = false;
  }
  enter() { playMusic('results'); }
  update(dt) {
    this.t += dt;
    if (this.t > 3.2 && !this.stamped) { this.stamped = true; play('stamp'); G.shake = 10; }
    if (this.t > 3.6 && menu.confirm && !iris.busy()) { play('menu_select'); iris.close(() => (this.def.after ? this.def.after(this.diff) : nav.map())); }
  }
  draw(ctx) {
    ctx.fillStyle = '#3b2412'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 24; i++) { ctx.fillStyle = i % 2 ? '#4a2e17' : '#3b2412'; ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.arc(W / 2, H / 2, 1200, (i / 24) * 6.283 + G.time * 0.1, ((i + 1) / 24) * 6.283 + G.time * 0.1); ctx.fill(); }
    panel(ctx, 150, 60, 980, 600);
    text(ctx, 'THE RESULTS', W / 2, 118, 58, '#c0392b', 'center', FONT_TITLE, 0);
    text(ctx, `${this.def.name} · ${DIFFS[this.diff]}`, W / 2, 166, 24, INK, 'center', FONT_UI, 0);
    const r = this.res;
    const fmt = (sec) => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
    const rows = [
      ['Time', r.time, (v) => fmt(v), ` / ${fmt(r.par)}`],
      ['Hits Taken', Math.round(r.hits * 10) / 10, (v) => `${Math.round(v * 10) / 10}`, ''],
      ['Parries', Math.min(3, r.parries), (v) => `${Math.round(v)}`, ' / 3'],
      ['Super Meter', Math.min(6, r.cards), (v) => `${Math.round(v)}`, ' / 6'],
      ['Skill Level', null, () => '★'.repeat(this.diff + 1) + '☆'.repeat(2 - this.diff), ''],
    ];
    rows.forEach((row, i) => {
      const t0 = 0.4 + i * 0.5;
      if (this.t < t0) return;
      const k = Math.min(1, (this.t - t0) / 0.4);
      if (k < 1 && Math.floor(this.t * 30) !== Math.floor((this.t - 1 / 60) * 30)) play('menu_move', { volume: 0.5, rate: 1.4 });
      const y = 238 + i * 62;
      const slide = (1 - Math.min(1, (this.t - t0) * 5)) * -40;
      ctx.globalAlpha = Math.min(1, (this.t - t0) * 5);
      text(ctx, row[0], 230 + slide, y, 34, INK, 'left', FONT_TITLE, 0);
      ctx.strokeStyle = 'rgba(27,18,10,.3)'; ctx.setLineDash([4, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(470, y + 8); ctx.lineTo(560, y + 8); ctx.stroke(); ctx.setLineDash([]);
      const val = row[1] === null ? row[2]() : row[2](row[1] * k);
      text(ctx, val + row[3], 580, y, 34, '#7a1c1c', 'left', FONT_TITLE, 0);
      ctx.globalAlpha = 1;
    });
    // Victory dancer
    if (!this.hero) { this.hero = new Player(0, 960, 640, G.save.loadout[0]); this.hero.onGround = true; this.hero.facing = -1; }
    const h = this.hero; h.anim = this.t; h.victoryT = this.t; h.animate(1 / 60, null);
    ctx.save(); ctx.translate(h.x, h.y); ctx.scale(1.55, 1.55); ctx.translate(-h.x, -h.y); h.draw(ctx); ctx.restore();
    if (this.t > 3.2) {
      const k = Math.min(1, (this.t - 3.2) * 6);
      ctx.save(); ctx.translate(960, 230); ctx.rotate(-0.22); ctx.scale(2.6 - k * 1.6, 2.6 - k * 1.6);
      starburst(ctx, 0, 0, 100, 14, '#ffe39a', G.time * 0.3, 5);
      text(ctx, r.grade, 0, 4, 96, '#c0392b', 'center', FONT_TITLE, 6);
      ctx.restore();
    }
    if (this.t > 3.6) {
      let msg = '';
      if (this.newIou) msg = 'You collected an IOU for Big Tab!';
      else if ((this.def.type === 'boss' || this.def.type === 'plane') && this.diff === 0 && !G.save.iou[this.id]) msg = 'Beat it on Regular or Top Shelf to collect the IOU.';
      if (r.coinIds && r.coinIds.length) msg = `Coins found: ${r.coinIds.length}` + (msg ? '  ·  ' + msg : '');
      if (this.bonus) msg = `+${this.bonus} coins for a first win!` + (msg ? '  ·  ' + msg : '');
      if (msg) text(ctx, msg, 560, 570, 22, '#2f5e2c', 'center', FONT_UI, 0);
      ctx.globalAlpha = 0.55 + Math.sin(G.time * 5) * 0.45; text(ctx, 'Press JUMP to continue', 560, 620, 24, INK, 'center', FONT_TITLE, 0); ctx.globalAlpha = 1;
    }
  }
}
