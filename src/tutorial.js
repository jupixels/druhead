// The Practice Bar: a gentle tutorial that teaches every move.
import { G, W, H, INK, PINK, GROUND, clamp } from './core.js';
import { roundRect, text, circle, poly, pieEye, FONT_TITLE, FONT_UI } from './draw.js';
import { Proj, Enemy, drawCherry } from './entities.js';
import { binds, keyName } from './input.js';
import { play } from './audio.js';
import { watercolorTex } from './fx.js';

const K = (a) => (G.coop ? `${keyName(binds.left[a])} / ${keyName(binds.right[a])}` : `${keyName(binds.left[a])} or ${keyName(binds.right[a])}`);
const SEGS = [[0, 1900, GROUND], [2230, 3000, GROUND], [3360, 5600, GROUND]];

function target(x, y, hp = 5, big = false) {
  return new Enemy({ x, y, w: big ? 90 : 44, h: big ? 130 : 70, hp, contact: false, big,
    tick() {}, render(ctx, e) {
      const s = e.big ? 1.8 : 1;
      if (e.y < GROUND - 10) { roundRect(ctx, e.x - 50, e.y, 100, 14, 3, '#9a6030', 3); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x - 40, e.y); ctx.lineTo(e.x - 40, e.y - 400); ctx.moveTo(e.x + 40, e.y); ctx.lineTo(e.x + 40, e.y - 400); ctx.stroke(); }
      ctx.save(); ctx.translate(e.x, e.y); ctx.scale(s, s);
      roundRect(ctx, -18, -64, 36, 64, 10, '#2f5e2c', 3);
      roundRect(ctx, -7, -84, 14, 22, 4, '#2f5e2c', 3);
      circle(ctx, 0, -34, 13, '#f3e6c4', 2.5); circle(ctx, 0, -34, 8, '#c0392b', 2); circle(ctx, 0, -34, 3, '#f3e6c4', 0);
      ctx.restore();
    },
    onDeath(w, e) { w.popEnemy(e); play('glass_shatter', { volume: 0.5, vary: 0.2 }); w.debris(e.x, e.y - 40, '#2f5e2c', 6, 10); } });
}

export const tutorialLevel = {
  id: 'tutorial', type: 'run', name: 'The Practice Bar', subtitle: 'Learn the ropes', music: 'map', par: 999,
  introText: 'PRACTICE!', introSub: 'Take your time. Nothing here can hurt you.', winText: 'READY TO BRAWL!',
  spawnX: 160, noGrade: true,
  setup(w) {
    w.length = 5600; w.segs = SEGS;
    w.invincible = true;
    w.platforms.push({ x: 1180, y: 470, w: 200 }, { x: 1460, y: 380, w: 200 });
    w.enemies.push(target(900, GROUND), target(1060, GROUND), target(1560, 380 - 0), target(2700, GROUND - 0, 5));
    w.enemies.push(target(2480, 300, 5));
    w.enemies.push(target(4300, GROUND, 40, true));
    w.flagX = 5300;
    for (const [x, y] of [[3070, 480], [3180, 450], [3290, 480]]) w.eBullets.push(new Proj({ x, y, r: 20, parry: true, harmless: true, life: 1e9, killOffscreen: false, home: [x, y], render: (ctx, b) => drawCherry(ctx, b.x, b.y + Math.sin(G.time * 3 + b.x) * 5, b.r), onParry(w) { this.hidden = 1.2; this.harmless = true; this.parry = false; }, tick(dt, w, b) { if (b.hidden > 0) { b.hidden -= dt; b.y = -500; if (b.hidden <= 0) { b.y = b.home[1]; b.parry = true; } } } }));
    w.signs = [
      [300, () => `Move: ${K('left')} ${K('right')}`, () => `Jump: ${K('jump')} (hold to jump higher)`],
      [700, () => `Shoot: hold ${K('shoot')}`, () => 'Break the bottles!'],
      [1100, () => 'Hop up the platforms.', () => `Drop down: ${K('down')} + jump`],
      [1500, () => `Hold ${K('lock')} to stand still`, () => 'and aim in any direction.'],
      [1830, () => `Dash: ${K('dash')}`, () => 'Jump, then dash in the air to cross!'],
      [2450, () => `Duck: hold ${K('down')}`, () => 'to dodge low and shoot low.'],
      [2850, () => 'PINK things can be PARRIED!', () => `Jump, then press ${K('jump')} again while touching pink.`],
      [3560, () => 'Each parry fills a drink card.', () => 'Damage fills them too.'],
      [3950, () => `EX shot: press ${K('ex')} (costs 1 card)`, () => `Swap weapons: ${K('swap')}`],
      [4700, () => 'With all 5 cards full,', () => `press ${K('ex')} for a SUPER!`],
    ];
  },
  groundAt(x, w) { for (const s of w.segs) if (x >= s[0] && x <= s[1]) return s[2]; return 99999; },
  safeX(p, w) { for (let i = w.segs.length - 1; i >= 0; i--) if (w.segs[i][1] < p.x + 1) return w.segs[i][1] - 80; return 200; },
  progress(w) { return clamp(Math.max(...w.players.map((p) => p.x)) / w.flagX, 0, 1); },
  update(dt, w) {
    for (const p of w.players) { p.invuln = Math.max(p.invuln, 0.05); p.hp = p.maxHp; if (p.meter < 100 && p.x > 3900) p.addMeter(60 * dt); if (p.x > 4600 && p.meter < 500) p.addMeter(200 * dt); }
    const alive = w.alivePlayers();
    const lead = alive.length ? Math.max(...alive.map((p) => p.x)) : 0;
    w.camX = clamp(Math.max(w.camX, lead - 520), 0, w.length - W);
    w.bounds.left = w.camX + 20; w.bounds.right = w.camX + W - 20;
    if (alive.some((p) => p.x >= w.flagX)) { G.save.tutorialDone = true; w.win(); }
  },
  drawBg(ctx, w) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#5a3218'); g.addColorStop(1, '#8a5428');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const off = -(w.camX * 0.4) % 320;
    for (let x = off; x < W + 320; x += 320) {
      ctx.fillStyle = '#4a2810'; ctx.fillRect(x, 0, 18, H);
      roundRect(ctx, x + 60, 120, 200, 130, 8, '#e9c77a', 5);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + 160, 120); ctx.lineTo(x + 160, 250); ctx.stroke();
    }
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(watercolorTex(), 0, 0); ctx.restore();
  },
  drawMid(ctx, w) {
    for (const [a, b, y] of w.segs) {
      ctx.fillStyle = '#6b3a1a'; ctx.fillRect(a, y, b - a, H - y + 50);
      ctx.fillStyle = '#8a4e24'; ctx.fillRect(a, y, b - a, 14);
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.strokeRect(a, y, b - a, H - y + 60);
      ctx.strokeStyle = 'rgba(20,10,0,.35)'; ctx.lineWidth = 2; for (let x = a + 60; x < b; x += 110) { ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x - 30, H); ctx.stroke(); }
    }
    // Signs
    for (const [x, l1, l2] of w.signs) {
      if (x < w.camX - 300 || x > w.camX + W + 300) continue;
      const y = GROUND - 250;
      ctx.fillStyle = INK; ctx.fillRect(x - 5, y + 60, 10, GROUND - y - 60);
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(G.time * 1.5 + x) * 0.015);
      roundRect(ctx, -170, -10, 340, 86, 8, '#c9a06a', 4);
      ctx.strokeStyle = 'rgba(60,30,10,.4)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-160, 16 + i * 22); ctx.lineTo(160, 16 + i * 22); ctx.stroke(); }
      text(ctx, l1(), 0, 18, 20, INK, 'center', FONT_TITLE, 0);
      text(ctx, l2(), 0, 48, 17, '#5a1a1a', 'center', FONT_UI, 0);
      ctx.restore();
    }
    // Exit door
    const fx = w.flagX + 60;
    roundRect(ctx, fx - 60, GROUND - 170, 120, 170, 8, '#2e1a0c', 5);
    roundRect(ctx, fx - 50, GROUND - 150, 48, 140, 4, '#d9a93a', 3); roundRect(ctx, fx + 2, GROUND - 150, 48, 140, 4, '#d9a93a', 3);
    roundRect(ctx, fx - 90, GROUND - 230, 180, 50, 8, '#7a1c1c', 4);
    text(ctx, 'TO THE ISLES', fx, GROUND - 205, 20, '#ffd86a', 'center', FONT_TITLE, 0);
  },
  drawPlatform(ctx, p) { roundRect(ctx, p.x, p.y, p.w, 22, 5, '#9a6030', 4); },
};
