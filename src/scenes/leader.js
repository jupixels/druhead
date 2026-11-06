// Cold open: a click-to-start card, then an old film countdown leader into the title.
import { G, W, H, INK } from '../core.js';
import { text, circle, FONT_TITLE, FONT_UI } from '../draw.js';
import { menu } from '../input.js';
import { iris } from '../fx.js';
import { play, playMusic } from '../audio.js';
import { nav } from './nav.js';

export class LeaderScene {
  constructor() { this.t = 0; this.started = false; this.lastN = 0; }
  enter() { playMusic(null); }
  update(dt) {
    if (!this.started) {
      this.t += dt;
      if (menu.any || this.clicked) { this.started = true; this.t = 0; play('menu_select'); }
      return;
    }
    this.t += dt;
    const n = 3 - Math.floor(this.t / 0.9);
    if (n !== this.lastN && n >= 1) { this.lastN = n; play('menu_move', { rate: 0.6, volume: 1 }); }
    if (this.t > 0.6 && menu.any && !this.skipping) { this.skipping = true; iris.close(() => nav.title()); }
    if (this.t > 3.0 && !this.done) { this.done = true; play('bell'); }
    if (this.t > 5.6 && !this.skipping) { this.skipping = true; iris.close(() => nav.title()); }
  }
  draw(ctx) {
    ctx.fillStyle = '#16100a'; ctx.fillRect(0, 0, W, H);
    if (!this.started) {
      // Projector-lamp glow
      const g = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 520);
      g.addColorStop(0, '#5a4630'); g.addColorStop(1, '#16100a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      text(ctx, 'DRUNKHEAD', W / 2, H / 2 - 40, 84, '#ffe39a', 'center', FONT_TITLE, 10);
      if (Math.floor(this.t * 1.6) % 2 === 0) text(ctx, 'Press any key to roll the film', W / 2, H / 2 + 50, 28, '#f3e6c4', 'center', FONT_UI, 5);
      text(ctx, 'Best with sound on  ·  Keyboard or gamepad', W / 2, H - 50, 18, '#a89070', 'center', FONT_UI, 0);
      return;
    }
    if (this.t < 2.7) {
      // Countdown leader: crosshair, rings, sweeping wedge, number
      const n = 3 - Math.floor(this.t / 0.9), k = (this.t % 0.9) / 0.9;
      ctx.fillStyle = '#d8cfba'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, H / 2);
      ctx.fillStyle = '#9c927e';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 900, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-W, 0); ctx.lineTo(W, 0); ctx.moveTo(0, -H); ctx.lineTo(0, H); ctx.stroke();
      ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, 230, 0, 7); ctx.stroke();
      ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 0, 270, 0, 7); ctx.stroke();
      text(ctx, String(n), 0, 14, 300, INK, 'center', FONT_TITLE, 0);
      ctx.restore();
      // Gate weave + flicker
      if (Math.random() < 0.3) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 0, W, H); }
      return;
    }
    // Title card
    const t = this.t - 2.7;
    ctx.fillStyle = '#16100a'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = Math.min(1, t * 2) * (this.t > 5.2 ? Math.max(0, 1 - (this.t - 5.2) * 2.5) : 1);
    // Art-deco frame
    ctx.strokeStyle = '#c9a03a'; ctx.lineWidth = 6; ctx.strokeRect(150, 110, W - 300, H - 220);
    ctx.lineWidth = 2; ctx.strokeRect(170, 130, W - 340, H - 260);
    for (const [x, y] of [[150, 110], [W - 150, 110], [150, H - 110], [W - 150, H - 110]]) circle(ctx, x, y, 14, '#c9a03a', 3);
    text(ctx, 'A TIPSY ISLES PICTURE', W / 2, 220, 30, '#c9a03a', 'center', FONT_UI, 0);
    text(ctx, 'presents', W / 2, 280, 26, '#a89070', 'center', FONT_UI, 0);
    const s = 1 + Math.max(0, 0.3 - t) * 2;
    ctx.save(); ctx.translate(W / 2, 390); ctx.scale(s, s);
    text(ctx, 'DRUNKHEAD', 0, 0, 110, '#ffe39a', 'center', FONT_TITLE, 10);
    ctx.restore();
    text(ctx, 'in  "SETTLE YOUR TAB"', W / 2, 490, 30, '#f3e6c4', 'center', FONT_TITLE, 0);
    ctx.restore();
  }
}
