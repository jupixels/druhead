// Temporary routing for step 1: the map goes straight to the first fight.
import { G, W, H, INK } from '../core.js';
import { panel, text, FONT_TITLE } from '../draw.js';
import { Menu } from '../ui.js';
import { iris } from '../fx.js';

class TempMap {
  constructor(nav) {
    this.menu = new Menu([
      { label: 'Fight Sir Hops-a-Lot (Light)', action: () => iris.close(() => nav.level('hops', 0)) },
      { label: 'Fight Sir Hops-a-Lot (Regular)', action: () => iris.close(() => nav.level('hops', 1)) },
      { label: 'Fight Sir Hops-a-Lot (Top Shelf)', action: () => iris.close(() => nav.level('hops', 2)) },
      { label: 'Back to Title', action: () => iris.close(() => nav.title()) },
    ]);
  }
  update() { if (!iris.busy()) this.menu.update(); }
  draw(ctx) {
    ctx.fillStyle = '#5a3218'; ctx.fillRect(0, 0, W, H);
    panel(ctx, 280, 160, 720, 400);
    text(ctx, 'Test Bar', W / 2, 220, 44, '#c0392b', 'center', FONT_TITLE, 0);
    this.menu.draw(ctx, W / 2, 300, 30, 60);
  }
}

export function registerExtraScenes(nav) {
  nav.register('map', () => new TempMap(nav));
  nav.register('story', (after) => ({ update() { after(); }, draw() {} }));
}
