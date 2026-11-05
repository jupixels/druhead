// Plays one level (boss, run-and-gun, plane, or parry challenge).
import { G, W, H, INK } from '../core.js';
import { World, DIFFS } from '../world.js';
import { LEVELS, gradeFor } from '../levels.js';
import { menu } from '../input.js';
import { Menu } from '../ui.js';
import { panel, text, FONT_TITLE, FONT_UI } from '../draw.js';
import { iris } from '../fx.js';
import { playMusic, play } from '../audio.js';
import { nav } from './nav.js';

export class LevelScene {
  constructor(id, diff) {
    this.id = id; this.diff = diff;
    this.def = LEVELS[id];
    this.start();
    this.paused = false;
    this.pauseMenu = new Menu([
      { label: 'Resume', action: () => (this.paused = false) },
      { label: 'Retry', action: () => this.retry() },
      { label: 'Exit to Map', action: () => this.exit() },
    ], { back: () => (this.paused = false) });
    this.loseMenu = new Menu([
      { label: 'Retry', action: () => this.retry() },
      { label: 'Exit to Map', action: () => this.exit() },
    ]);
    this.done = false;
  }
  start() {
    const lo = G.save.loadout;
    this.world = new World(this.def, { diff: this.diff, coop: G.coop, loadouts: [lo[0], lo[1]] });
  }
  enter() { playMusic(this.def.music); }
  retry() { iris.close(() => { this.start(); this.paused = false; this.loseMenu.i = 0; }); }
  exit() { iris.close(() => nav.map()); }

  update(dt) {
    if (iris.busy()) { return; }
    const w = this.world;
    if (this.paused) { this.pauseMenu.update(); return; }
    if (menu.pause && w.state === 'play') { this.paused = true; this.pauseMenu.i = 0; play('menu_select'); return; }
    w.update(dt);
    if (w.state === 'lose' && w.stateT > 1.4) this.loseMenu.update();
    if (w.state === 'ko' && w.stateT > 3.4 && !this.done) {
      this.done = true;
      const res = gradeFor(w);
      res.coins = w.stats.coins;
      res.coinIds = w.coinIds || [];
      iris.close(() => nav.results(this.id, this.diff, res));
    }
  }
  draw(ctx) {
    this.world.draw(ctx);
    const w = this.world;
    if (w.state === 'lose' && w.stateT > 1.4) this.loseMenu.draw(ctx, W / 2, 470, 32, 46);
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H);
      panel(ctx, W / 2 - 220, 170, 440, 340);
      text(ctx, 'PAUSED', W / 2, 225, 46, '#c0392b', 'center', FONT_TITLE, 0);
      text(ctx, `${this.def.name} · ${DIFFS[this.diff]}`, W / 2, 268, 20, INK, 'center', FONT_UI, 0);
      this.pauseMenu.draw(ctx, W / 2, 330, 32, 52);
    }
  }
}
