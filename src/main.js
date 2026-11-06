// Boot + main loop.
import { G, W, H } from './core.js';
import { pollInput } from './input.js';
import { initFx, drawFilm, iris } from './fx.js';
import { initAudio, applyVolume } from './audio.js';
import { loadSettings } from './save.js';
import { nav } from './scenes/nav.js';
import { TitleScene, applyCanvasFilter } from './scenes/title.js';
import { LeaderScene } from './scenes/leader.js';
import { LevelScene } from './scenes/level.js';
import { ResultsScene } from './scenes/results.js';
import { registerExtraScenes } from './scenes/extra.js';

G.canvas = document.getElementById('game');
G.ctx = G.canvas.getContext('2d');

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  G.canvas.style.width = `${Math.floor(W * s)}px`;
  G.canvas.style.height = `${Math.floor(H * s)}px`;
}
addEventListener('resize', fit); fit();

loadSettings();
applyCanvasFilter();
initFx();
initAudio().then(applyVolume);

nav.register('title', () => new TitleScene());
nav.register('level', (id, d) => new LevelScene(id, d));
nav.register('results', (id, d, r) => new ResultsScene(id, d, r));
registerExtraScenes(nav);

let muted = false, prevVol = 0.8;
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { muted = !muted; if (muted) { prevVol = G.settings.volume; G.settings.volume = 0; } else G.settings.volume = prevVol || 0.8; applyVolume(); }
});

addEventListener('pointerdown', () => { if (G.scene) G.scene.clicked = true; });
G.setScene(new LeaderScene());

const STEP = 1 / 60;
let last = performance.now(), acc = 0;
function frame(now) {
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 4) {
    acc -= STEP; steps++;
    G.time += STEP; G.frame++;
    G.boil = Math.floor(G.time * 12);
    pollInput();
    iris.update(STEP);
    if (G.hitstop > 0) { G.hitstop -= STEP; continue; }
    G.scene && G.scene.update(STEP);
    G.shake = Math.max(0, G.shake - STEP * 40);
  }
  if (steps >= 4) acc = 0;
  const ctx = G.ctx;
  ctx.save();
  if (G.shake > 0 && G.settings.shake) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
  G.scene && G.scene.draw(ctx);
  ctx.restore();
  drawFilm(ctx);
  iris.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__G = G; window.__nav = nav;
