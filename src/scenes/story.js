// Storybook intro and ending.
import { G, W, H, INK, PINK } from '../core.js';
import { panel, text, roundRect, circle, ellipse, poly, starburst, FONT_TITLE, FONT_UI } from '../draw.js';
import { menu } from '../input.js';
import { iris } from '../fx.js';
import { play, playMusic } from '../audio.js';
import { Player } from '../player.js';
import { Tab } from '../bosses/tab.js';
import { wrapText } from './map.js';
import { writeSave } from '../save.js';
import { nav } from './nav.js';

const fakeWorld = { diff: 1 };
function pals(t) {
  const a = new Player(0, 0, 0, { weapons: ['beer'] }), b = new Player(1, 0, 0, { weapons: ['beer'] });
  for (const p of [a, b]) { p.onGround = true; p.anim = t; }
  b.facing = -1;
  return [a, b];
}

function drawSaloon(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  roundRect(ctx, -160, -140, 320, 200, 6, '#a0602c', 5);
  poly(ctx, [[-180, -140], [180, -140], [140, -200], [-140, -200]], '#6b3a1a', 5);
  roundRect(ctx, -130, -270, 260, 70, 8, '#2e1a0c', 5);
  text(ctx, 'LAST CALL', 0, -235, 40, '#ffd86a', 'center', FONT_TITLE, 0);
  roundRect(ctx, -46, -40, 92, 100, 4, '#2e1a0c', 4);
  roundRect(ctx, -42, -20, 40, 56, 3, '#d9a93a', 3); roundRect(ctx, 2, -20, 40, 56, 3, '#d9a93a', 3);
  for (const wx of [-110, 110]) roundRect(ctx, wx - 28, -100, 56, 48, 4, Math.floor(t * 3) % 2 ? '#ffe39a' : '#ffd060', 4);
  ctx.restore();
}

const INTRO = [
  { txt: 'Once upon a time, on the Tipsy Isles, stood the rowdiest joint of them all: the Last Call Saloon.',
    art(ctx, t) { drawSaloon(ctx, 640, 380, 1.1, t); for (let i = 0; i < 5; i++) text(ctx, '♪', 460 + i * 90, 150 + Math.sin(t * 3 + i) * 12, 34, INK, 'center', FONT_UI, 0); } },
  { txt: 'Two pals, Shotty and Pint, spent every night there, drinking on credit and dancing on the tables.',
    art(ctx, t) {
      roundRect(ctx, 300, 330, 680, 40, 6, '#9a6030', 5); roundRect(ctx, 320, 370, 640, 90, 6, '#6b3a1a', 5);
      const [a, b] = pals(t);
      a.x = 560; a.y = 330 - Math.abs(Math.sin(t * 6)) * 20; b.x = 720; b.y = 330 - Math.abs(Math.cos(t * 6)) * 20; a.vx = 100; b.vx = 100;
      a.draw(ctx); b.draw(ctx);
    } },
  { txt: 'One night the owner, Barnaby "Big Tab" Tapsworth, slammed down their bill. It was longer than the bar itself!',
    art(ctx, t) {
      const tab = new Tab(fakeWorld); tab.t = t; tab.x = 900; tab.y = 0;
      ctx.save(); ctx.translate(0, 470); ctx.scale(0.8, 0.8); ctx.translate(200, 0); tab.draw(ctx, fakeWorld); ctx.restore();
      ctx.save(); ctx.translate(430, 160); ctx.rotate(-0.08 + Math.sin(t * 2) * 0.02);
      roundRect(ctx, -90, 0, 180, 300, 4, '#f3e6c4', 4);
      for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-70, 24 + i * 26, 100, 6); text(ctx, '$' + (i + 1) * 13, 60, 27 + i * 26, 14, INK, 'right', FONT_UI, 0); }
      text(ctx, 'TOTAL: A LOT', 0, 270, 22, '#c0392b', 'center', FONT_TITLE, 0);
      ctx.restore();
    } },
  { txt: '"Can\'t pay?" he boomed. "Then collect from my deadbeat debtors! Bring me five IOUs and I\'ll call it square."',
    art(ctx, t) {
      const names = ['Sir Hops-a-Lot', 'Madame Merlot', 'The Agave Brothers', 'Captain Rumbeard', 'The Mixologist'];
      names.forEach((n, i) => { const x = 220 + i * 210, y = 280 + Math.sin(t * 2 + i) * 10; ctx.save(); ctx.translate(x, y); ctx.rotate((i - 2) * 0.06); roundRect(ctx, -85, -110, 170, 220, 4, '#e8d29a', 4); text(ctx, 'IOU', 0, -60, 46, '#7a1c1c', 'center', FONT_TITLE, 0); wrapText(ctx, n, -70, 10, 140, 20, 24); ctx.restore(); });
    } },
  { txt: 'And so the two pals set off across the Tipsy Isles, determined to settle their tab once and for all...',
    art(ctx, t) {
      ctx.fillStyle = '#3f7f8f'; ctx.fillRect(200, 330, 880, 140);
      for (const [x, r] of [[380, 120], [700, 90], [960, 110]]) ellipse(ctx, x, 360, r, 40, '#8dbb5a', 4);
      const [a, b] = pals(t); a.x = 600 + Math.sin(t) * 30; a.y = 330; b.x = 660 + Math.sin(t) * 30; b.y = 330; b.facing = 1; a.vx = b.vx = 100; a.draw(ctx); b.draw(ctx);
    } },
];

const ENDING = [
  { txt: 'With every IOU collected and Big Tab knocked flat, his ledger burst into a thousand pieces of confetti.',
    art(ctx, t) { for (let i = 0; i < 40; i++) { const x = 220 + ((i * 97 + t * 60) % 840), y = 120 + ((i * 53 + t * 120) % 340); ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + i); roundRect(ctx, -10, -6, 20, 12, 2, ['#ffd84a', PINK, '#8dd14f', '#9fd8ff'][i % 4], 2); ctx.restore(); } } },
  { txt: 'Every debt on the Tipsy Isles was forgiven, and the Last Call Saloon became everybody\'s saloon.',
    art(ctx, t) { drawSaloon(ctx, 640, 400, 1.0, t); for (let i = 0; i < 6; i++) starburst(ctx, 360 + i * 110, 140 + Math.sin(t * 4 + i) * 16, 22, 7, '#ffe14a', t, 3); } },
  { txt: 'As for Shotty and Pint? They paid off their tab the only way they knew how... by running the bar themselves. THE END',
    art(ctx, t) {
      roundRect(ctx, 300, 330, 680, 40, 6, '#9a6030', 5); roundRect(ctx, 320, 370, 640, 90, 6, '#6b3a1a', 5);
      const [a, b] = pals(t); a.x = 540; a.y = 330; b.x = 740; b.y = 330; a.draw(ctx); b.draw(ctx);
      text(ctx, 'NOW SERVING', 640, 110, 48, '#c0392b', 'center', FONT_TITLE, 6);
    } },
];

class Book {
  constructor(pages, after, music) { this.pages = pages; this.after = after; this.i = 0; this.t = 0; this.chars = 0; this.music = music; }
  enter() { playMusic(this.music); }
  update(dt) {
    this.t += dt;
    if (iris.busy()) return;
    const full = this.pages[this.i].txt.length;
    this.chars = Math.min(full, this.chars + dt * 45);
    if (menu.confirm || menu.back) {
      if (menu.back && !this.skipHint) { this.skipHint = true; }
      if (menu.back) { iris.close(() => this.after()); return; }
      if (this.chars < full) { this.chars = full; return; }
      play('whoosh', { rate: 1.6, volume: 0.6 });
      this.i++; this.chars = 0; this.turn = 1;
      if (this.i >= this.pages.length) { this.i = this.pages.length - 1; iris.close(() => this.after()); }
    }
    this.turn = Math.max(0, (this.turn || 0) - dt * 3);
  }
  draw(ctx) {
    ctx.fillStyle = '#2a160a'; ctx.fillRect(0, 0, W, H);
    // Open book
    ctx.save(); ctx.translate(W / 2, H / 2);
    roundRect(ctx, -600, -330, 1200, 660, 24, '#5a1a1a', 6);
    roundRect(ctx, -580, -312, 1160, 624, 16, '#f3e6c4', 4);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -312); ctx.lineTo(0, 312); ctx.stroke();
    ctx.restore();
    const pg = this.pages[this.i];
    ctx.save();
    ctx.beginPath(); ctx.rect(80, 50, 1120, 470); ctx.clip();
    if (this.turn > 0) { ctx.translate(W / 2, 0); ctx.scale(1 - this.turn, 1); ctx.translate(-W / 2, 0); }
    pg.art(ctx, this.t);
    ctx.restore();
    const shown = pg.txt.slice(0, Math.floor(this.chars));
    ctx.save();
    wrapText(ctx, shown, 140, 560, 1000, 28, 36);
    ctx.restore();
    text(ctx, `${this.i + 1} / ${this.pages.length}`, W - 140, H - 60, 18, INK, 'right', FONT_UI, 0);
    text(ctx, 'JUMP: next · BACK: skip', 140, H - 60, 18, '#7a4a20', 'left', FONT_UI, 0);
  }
}

export class StoryScene extends Book { constructor(after) { super(INTRO, after, 'story'); } }
export class EndingScene extends Book {
  constructor() {
    super(ENDING, () => nav.map(), 'title');
    if (G.save) { G.save.bwUnlocked = true; writeSave(); }
  }
}
