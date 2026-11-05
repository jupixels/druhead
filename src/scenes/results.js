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
    panel(ctx, 240, 70, 800, 580);
    text(ctx, 'THE RESULTS', W / 2, 130, 56, '#c0392b', 'center', FONT_TITLE, 0);
    text(ctx, `${this.def.name} · ${DIFFS[this.diff]}`, W / 2, 178, 24, INK, 'center', FONT_UI, 0);
    const r = this.res;
    const mm = Math.floor(r.time / 60), ss = Math.floor(r.time % 60).toString().padStart(2, '0');
    const rows = [
      ['Time', `${mm}:${ss}`, `/ ${Math.floor(r.par / 60)}:${(r.par % 60).toString().padStart(2, '0')}`],
      ['Hits Taken', `${Math.round(r.hits * 10) / 10}`, ''],
      ['Parries', `${Math.min(3, r.parries)}`, '/ 3'],
      ['Super Meter', `${Math.min(6, r.cards)}`, '/ 6'],
      ['Skill Level', '★'.repeat(this.diff + 1) + '☆'.repeat(2 - this.diff), ''],
    ];
    rows.forEach((row, i) => {
      if (this.t < 0.4 + i * 0.45) return;
      const y = 250 + i * 58;
      text(ctx, row[0], 330, y, 32, INK, 'left', FONT_TITLE, 0);
      ctx.strokeStyle = 'rgba(27,18,10,.3)'; ctx.setLineDash([4, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(560, y + 8); ctx.lineTo(720, y + 8); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, row[1] + ' ' + row[2], 760, y, 32, '#7a1c1c', 'left', FONT_TITLE, 0);
    });
    if (this.t > 3.2) {
      const k = Math.min(1, (this.t - 3.2) * 6);
      ctx.save(); ctx.translate(900, 290); ctx.rotate(-0.25); ctx.scale(2.4 - k * 1.4, 2.4 - k * 1.4);
      starburst(ctx, 0, 0, 95, 14, '#ffe39a', 0, 5);
      text(ctx, r.grade, 0, 4, 92, '#c0392b', 'center', FONT_TITLE, 6);
      ctx.restore();
      text(ctx, 'GRADE', 900, 410, 28, INK, 'center', FONT_TITLE, 0);
    }
    if (this.t > 3.6) {
      let msg = '';
      if (this.newIou) msg = 'You collected an IOU for Big Tab!';
      else if ((this.def.type === 'boss' || this.def.type === 'plane') && this.diff === 0 && !G.save.iou[this.id]) msg = 'Beat it on Regular or Top Shelf to collect the IOU.';
      if (r.coinIds && r.coinIds.length) msg = `Coins found: ${r.coinIds.length}` + (msg ? '  ·  ' + msg : '');
      if (this.bonus) msg = `+${this.bonus} coins for a first win!` + (msg ? '  ·  ' + msg : '');
      if (msg) text(ctx, msg, W / 2, 560, 22, '#2f5e2c', 'center', FONT_UI, 0);
      if (Math.floor(G.time * 2) % 2) text(ctx, 'Press JUMP to continue', W / 2, 610, 22, INK, 'center', FONT_UI, 0);
    }
  }
}
