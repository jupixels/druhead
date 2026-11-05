// Barkeep Barley's Back Room: spend coins on weapons and trinkets.
import { G, W, H, INK } from '../core.js';
import { panel, text, roundRect, circle, ellipse, poly, pieEye, mouth, hose, glove, FONT_TITLE, FONT_UI } from '../draw.js';
import { menu } from '../input.js';
import { iris } from '../fx.js';
import { play, playMusic } from '../audio.js';
import { writeSave } from '../save.js';
import { WEAPONS, TRINKETS } from '../weapons.js';
import { drawCoin, wrapText } from './map.js';
import { nav } from './nav.js';

const STOCK = [
  { type: 'weapon', id: 'wine' }, { type: 'weapon', id: 'champ' }, { type: 'weapon', id: 'tequila' }, { type: 'weapon', id: 'vodka' },
  { type: 'trinket', id: 'opener' }, { type: 'trinket', id: 'coaster' }, { type: 'trinket', id: 'icebucket' }, { type: 'trinket', id: 'penny' }, { type: 'trinket', id: 'driver' },
];
const BOTTLE_COLORS = { wine: '#6e1430', champ: '#2f5e2c', tequila: '#d9c46a', vodka: '#cfe8f5' };

export class ShopScene {
  constructor() { this.i = 0; this.t = 0; this.say = 'Welcome to the Back Room, pal. Whaddaya buyin\'?'; this.sayT = 0; }
  enter() { playMusic('shop'); }
  owned(it) { const s = G.save; return it.type === 'weapon' ? s.weapons.includes(it.id) : s.trinkets.includes(it.id); }
  info(it) { return it.type === 'weapon' ? WEAPONS[it.id] : TRINKETS[it.id]; }
  update(dt) {
    this.t += dt;
    if (iris.busy()) return;
    if (menu.left) { this.i = (this.i - 1 + STOCK.length) % STOCK.length; play('menu_move'); }
    if (menu.right) { this.i = (this.i + 1) % STOCK.length; play('menu_move'); }
    if (menu.up && this.i >= 4) { this.i = Math.min(3, this.i - 4); play('menu_move'); }
    if (menu.down && this.i < 4) { this.i = Math.min(8, this.i + 4); play('menu_move'); }
    if (menu.confirm) {
      const it = STOCK[this.i], inf = this.info(it), s = G.save;
      if (this.owned(it)) { this.say = 'You already got one of those!'; play('menu_back'); }
      else if (s.coins < inf.price) { this.say = 'No coin, no deal. Come back when your pockets jingle.'; play('menu_back'); }
      else {
        s.coins -= inf.price;
        (it.type === 'weapon' ? s.weapons : s.trinkets).push(it.id);
        writeSave(); play('buy');
        this.say = it.type === 'weapon' ? `The ${inf.name}! Equip it from the map with your EX button.` : `A fine ${inf.name}. Equip it from the map.`;
      }
    }
    if (menu.back || menu.pause) { play('menu_back'); iris.close(() => nav.map()); }
  }
  draw(ctx) {
    // Back room
    ctx.fillStyle = '#3b2412'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3;
    for (let x = 0; x < W; x += 70) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    // Hanging lamp
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2 + Math.sin(this.t) * 6, 50); ctx.stroke();
    const g = ctx.createRadialGradient(W / 2, 80, 10, W / 2, 200, 600); g.addColorStop(0, 'rgba(255,220,140,.35)'); g.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    poly(ctx, [[W / 2 - 40 + Math.sin(this.t) * 6, 80], [W / 2 + 40 + Math.sin(this.t) * 6, 80], [W / 2 + 20 + Math.sin(this.t) * 6, 50], [W / 2 - 20 + Math.sin(this.t) * 6, 50]], '#3b6b2c', 3);
    // Barley the barkeep
    this.drawBarley(ctx, 230, 470);
    // Shelves
    for (const sy of [250, 430]) { roundRect(ctx, 430, sy, 800, 18, 3, '#7a4a20', 4); }
    STOCK.forEach((it, k) => {
      const row = k < 4 ? 0 : 1, col = row ? k - 4 : k;
      const x = 500 + col * (row ? 150 : 190), y = row ? 430 : 250;
      const sel = k === this.i;
      const own = this.owned(it);
      ctx.save(); ctx.translate(x, y - (sel ? 8 + Math.sin(this.t * 6) * 3 : 0));
      if (own) ctx.globalAlpha = 0.35;
      if (it.type === 'weapon') {
        roundRect(ctx, -22, -90, 44, 90, 12, BOTTLE_COLORS[it.id], 4);
        roundRect(ctx, -9, -120, 18, 34, 4, BOTTLE_COLORS[it.id], 3);
        roundRect(ctx, -18, -62, 36, 30, 4, '#f3e6c4', 2.5);
      } else this.drawTrinket(ctx, it.id);
      ctx.restore();
      if (own) text(ctx, 'SOLD', x, y - 40, 22, '#c0392b', 'center', FONT_TITLE, 4);
      if (sel) { ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); ctx.strokeRect(x - 60, y - 150, 120, 160); ctx.setLineDash([]); }
    });
    // Info card
    const it = STOCK[this.i], inf = this.info(it);
    panel(ctx, 440, 500, 790, 190);
    text(ctx, inf.name, 470, 540, 34, '#c0392b', 'left', FONT_TITLE, 0);
    drawCoin(ctx, 1160, 540, this.t);
    text(ctx, `${inf.price}`, 1190, 542, 28, INK, 'left', FONT_UI, 0);
    wrapText(ctx, inf.desc + (it.type === 'weapon' ? `  EX: ${inf.ex}.` : ''), 470, 585, 720, 22, 28);
    text(ctx, 'JUMP: buy · ←→↑↓: browse · BACK: leave', 470, 660, 18, '#7a4a20', 'left', FONT_UI, 0);
    // Coins + speech
    roundRect(ctx, 20, 20, 170, 54, 10, '#f3e6c4', 3);
    drawCoin(ctx, 50, 47, this.t); text(ctx, `${G.save.coins}`, 80, 48, 28, INK, 'left', FONT_UI, 0);
    panel(ctx, 40, 110, 360, 120);
    wrapText(ctx, this.say, 60, 140, 320, 20, 26);
    text(ctx, "BARLEY'S BACK ROOM", 830, 60, 44, '#ffd86a', 'center', FONT_TITLE, 8);
  }
  drawTrinket(ctx, id) {
    switch (id) {
      case 'opener': roundRect(ctx, -8, -90, 16, 70, 6, '#bbb', 3); circle(ctx, 0, -95, 18, '#bbb', 3); circle(ctx, 0, -95, 8, '#3b2412', 2); break;
      case 'coaster': ellipse(ctx, 0, -30, 44, 16, '#d63a2a', 4); ellipse(ctx, 0, -32, 30, 10, '#f3e6c4', 2); break;
      case 'icebucket': poly(ctx, [[-34, -80], [34, -80], [26, 0], [-26, 0]], '#bbb', 4); for (let i = 0; i < 3; i++) roundRect(ctx, -24 + i * 16, -100, 16, 16, 3, '#e0f4ff', 2); break;
      case 'penny': circle(ctx, 0, -40, 30, '#c9762a', 4); circle(ctx, 0, -40, 20, '#e0a05a', 2); break;
      case 'driver': roundRect(ctx, -30, -80, 60, 70, 10, '#f3e6c4', 4); circle(ctx, -14, -10, 10, INK, 0); circle(ctx, 14, -10, 10, INK, 0); circle(ctx, 0, -50, 16, '#888', 3); break;
    }
  }
  drawBarley(ctx, x, y) {
    const b = Math.sin(this.t * 2.5) * 4;
    ctx.save(); ctx.translate(x, y + b);
    // Counter in front comes after; draw body
    ellipse(ctx, 0, -90, 120, 150, '#8a5a2a', 5);
    ctx.fillStyle = '#f3e6c4'; ctx.beginPath(); ctx.ellipse(0, -40, 80, 110, 0, 0, 7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    poly(ctx, [[-30, -170], [0, -150], [30, -170], [30, -130], [0, -150], [-30, -130]], '#d63a2a', 3);
    // Neck + cap
    roundRect(ctx, -30, -300, 60, 80, 10, '#8a5a2a', 4);
    roundRect(ctx, -36, -320, 72, 26, 6, '#c9a03a', 4);
    // Face
    pieEye(ctx, -40, -150 - 20, 18, 24, 0, Math.floor(this.t * 2) % 7 === 0);
    pieEye(ctx, 40, -170, 18, 24, 0, Math.floor(this.t * 2) % 7 === 0);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(0, -130); ctx.bezierCurveTo(-30, -100, -80, -110, -90, -130); ctx.bezierCurveTo(-60, -118, -30, -122, 0, -130);
    ctx.bezierCurveTo(30, -100, 80, -110, 90, -130); ctx.bezierCurveTo(60, -118, 30, -122, 0, -130); ctx.fill();
    // Barley stalk behind the "ear"
    ctx.strokeStyle = '#c9a03a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(100, -150); ctx.lineTo(140, -260); ctx.stroke();
    for (let i = 0; i < 5; i++) ellipse(ctx, 140 - i * 6 + (i % 2 ? 8 : -8), -250 + i * 18, 7, 12, '#e8c860', 2, i % 2 ? 0.5 : -0.5);
    // Arm with towel
    hose(ctx, -110, -110, -160, -60, -130, -10, 16, '#8a5a2a');
    glove(ctx, -130, -10, 18);
    roundRect(ctx, -150, -20, 40, 60, 6, '#fff', 3);
    ctx.restore();
    // Counter
    roundRect(ctx, 20, 460, 400, 260, 8, '#6b3a1a', 5);
    roundRect(ctx, 0, 440, 440, 30, 6, '#9a6030', 5);
  }
}
