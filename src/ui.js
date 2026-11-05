// Small reusable menu list.
import { G, INK } from './core.js';
import { text, FONT_UI, FONT_TITLE } from './draw.js';
import { menu } from './input.js';
import { play } from './audio.js';

export class Menu {
  constructor(items, opts = {}) { this.items = items; this.i = 0; this.opts = opts; }
  update() {
    const n = this.items.length;
    if (menu.up) { do { this.i = (this.i - 1 + n) % n; } while (this.items[this.i].disabled && n > 1); play('menu_move'); }
    if (menu.down) { do { this.i = (this.i + 1) % n; } while (this.items[this.i].disabled && n > 1); play('menu_move'); }
    const it = this.items[this.i];
    if (it.left && menu.left) { it.left(); play('menu_move'); }
    if (it.right && menu.right) { it.right(); play('menu_move'); }
    if (menu.confirm && it.action && !it.disabled) { play('menu_select'); it.action(); return true; }
    if (menu.back && this.opts.back) { play('menu_back'); this.opts.back(); return true; }
    return false;
  }
  draw(ctx, x, y, size = 34, gap = 48, color = INK, hi = '#c0392b', align = 'center') {
    this.items.forEach((it, k) => {
      const sel = k === this.i;
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const c = it.disabled ? 'rgba(60,40,20,.35)' : sel ? hi : color;
      const s = sel ? size * 1.08 : size;
      text(ctx, label, x, y + k * gap, s, c, align, FONT_TITLE, 0);
      if (sel) {
        const wv = ctx.measureText(label).width;
        const off = align === 'center' ? wv / 2 + 26 : align === 'left' ? -26 : wv + 26;
        text(ctx, '▸', align === 'left' ? x - 26 : x - off, y + k * gap, s, hi, 'center', FONT_UI, 0);
      }
    });
  }
}
