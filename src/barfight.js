import { paintify } from './fx.js';
// The Bar Fight: a parry-only challenge. Protect the tip jar from rowdy spirits.
import { G, W, H, INK, PINK, GROUND, clamp, rand, pick } from './core.js';
import { ellipse, circle, poly, roundRect, text, pieEye, mouth, FONT_TITLE, FONT_UI } from './draw.js';
import { Proj } from './entities.js';
import { play } from './audio.js';

const JAR = { x: 640, y: GROUND - 50, r: 46 };

function spawnSpirit(w, speed) {
  const side = pick(['left', 'right', 'top', 'left', 'right']);
  let x, y;
  if (side === 'left') { x = -40; y = rand(150, 520); } else if (side === 'right') { x = W + 40; y = rand(150, 520); } else { x = rand(150, W - 150); y = -40; }
  const ph = rand(0, 6);
  w.eBullets.push(new Proj({ x, y, r: 26, parry: true, harmless: true, life: 30, killOffscreen: false, ph, sp: speed,
    tick(dt, w, b) {
      const a = Math.atan2(JAR.y - b.y, JAR.x - b.x);
      b.vx = Math.cos(a) * b.sp + Math.cos(a + Math.PI / 2) * Math.sin(b.t * 3 + b.ph) * 120;
      b.vy = Math.sin(a) * b.sp + Math.sin(a + Math.PI / 2) * Math.sin(b.t * 3 + b.ph) * 120;
      if (Math.hypot(b.x - JAR.x, b.y - JAR.y) < JAR.r + b.r * 0.6) { b.dead = true; w.jarHit = true; }
    },
    onParry(w) { this.dead = true; w.parried++; w.puff(this.x, this.y, 40, '#ffd2e8'); },
    render(ctx, b) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(-20, -24); ctx.quadraticCurveTo(-26, 20, -18, 30);
      for (let i = 0; i < 3; i++) ctx.quadraticCurveTo(-12 + i * 12, 20 + (i % 2) * 10, -6 + i * 12, 30);
      ctx.quadraticCurveTo(26, 10, 20, -24); ctx.quadraticCurveTo(0, -40, -20, -24);
      ctx.fillStyle = PINK; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      roundRect(ctx, -7, -48, 14, 20, 4, '#ffc0dc', 2.5);
      pieEye(ctx, -7, -8, 5, 7, Math.atan2(JAR.y - b.y, JAR.x - b.x)); pieEye(ctx, 7, -8, 5, 7, Math.atan2(JAR.y - b.y, JAR.x - b.x));
      mouth(ctx, 0, 6, 6, 0.6);
      ctx.restore();
    } }));
}

let bg = null;
function buildBg() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a2e17'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = 3; for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND); ctx.stroke(); }
  // Broken mirror & bottles behind the bar
  roundRect(ctx, 380, 80, 520, 220, 10, '#9fb8c0', 6);
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(600, 80); ctx.lineTo(640, 180); ctx.lineTo(580, 300); ctx.moveTo(640, 180); ctx.lineTo(760, 220); ctx.stroke();
  roundRect(ctx, 260, 330, 760, 160, 6, '#6b3a1a', 5);
  roundRect(ctx, 240, 320, 800, 24, 6, '#9a6030', 5);
  // Overturned tables
  ellipse(ctx, 120, GROUND - 40, 90, 30, '#7a4a20', 4); ellipse(ctx, 1160, GROUND - 40, 90, 30, '#7a4a20', 4);
  ctx.fillStyle = '#5a3218'; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
  return paintify(c);
}

export const barfightLevel = {
  id: 'barfight', type: 'parry', name: 'The Bar Fight', subtitle: 'Parry only! Protect the tip jar.', music: 'barfight', par: 90,
  introText: 'BAR FIGHT!', introSub: 'No shooting! Parry the rowdy spirits before they reach the tip jar!',
  taunt: 'Somebody swiped the tips! You\'re fired!', winText: 'ORDER RESTORED!',
  spawnX: 560,
  setup(w) {
    w.parried = 0; w.jarHit = false;
    const waves = w.diff >= 2 ? [7, 9, 11, 13] : [5, 7, 9];
    w.waves = waves; w.wave = 0; w.toSpawn = waves[0]; w.spawnT = 1.0; w.waveGap = 0;
    w.total = waves.reduce((a, b) => a + b, 0);
    for (const p of w.players) p.noShoot = true;
    w.platforms.push({ x: 300, y: 490, w: 170 }, { x: 810, y: 490, w: 170 }, { x: 555, y: 390, w: 170 });
  },
  progress(w) { return clamp(w.parried / w.total, 0, 1); },
  update(dt, w) {
    if (w.jarHit) { w.lose(); play('glass_shatter'); return; }
    const speed = (w.diff >= 2 ? 170 : 130) + w.wave * 15;
    if (w.toSpawn > 0) {
      w.spawnT -= dt;
      if (w.spawnT <= 0) { w.spawnT = (w.diff >= 2 ? 0.9 : 1.2) - w.wave * 0.08; w.toSpawn--; spawnSpirit(w, speed); play('super_ghost', { volume: 0.25, rate: 1.6, cooldown: 0.4 }); }
    } else if (!w.eBullets.some((b) => b.parry)) {
      if (w.wave + 1 >= w.waves.length) { w.win(); return; }
      w.waveGap += dt;
      if (w.waveGap > 1.4) { w.wave++; w.toSpawn = w.waves[w.wave]; w.waveGap = 0; w.popText(640, 200, `ROUND ${w.wave + 1}!`, '#ffe39a', 44); play('bell'); }
    }
  },
  onWin(s, diff) {
    if (!s.supers.includes('courage')) s.supers.push('courage');
    if (diff >= 2 && !s.supers.includes('spirit')) s.supers.push('spirit');
  },
  drawBg(ctx, w) { if (!bg) bg = buildBg(); ctx.drawImage(bg, 0, 0); },
  drawMid(ctx, w) {
    // The tip jar
    const shake = w.eBullets.some((b) => b.parry && Math.hypot(b.x - JAR.x, b.y - JAR.y) < 200) ? Math.sin(G.time * 50) * 3 : 0;
    ctx.save(); ctx.translate(JAR.x + shake, GROUND);
    poly(ctx, [[-40, -110], [40, -110], [46, 0], [-46, 0]], 'rgba(220,240,255,.9)', 4);
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(-26 + (i % 3) * 26, -14 - Math.floor(i / 3) * 18); circle(ctx, 0, 0, 10, '#ffd84a', 2); ctx.restore(); }
    roundRect(ctx, -34, -80, 68, 30, 4, '#f3e6c4', 3);
    text(ctx, 'TIPS', 0, -64, 18, '#7a1c1c', 'center', FONT_TITLE, 0);
    ctx.restore();
  },
  drawPlatform(ctx, p) {
    ellipse(ctx, p.x + p.w / 2, p.y + 8, p.w / 2, 14, '#9a6030', 4);
    ctx.fillStyle = INK; ctx.fillRect(p.x + p.w / 2 - 5, p.y + 20, 10, GROUND - p.y - 20);
  },
  hud(ctx, w) {
    roundRect(ctx, W / 2 - 140, 18, 280, 44, 8, '#f3e6c4', 3);
    text(ctx, `Round ${w.wave + 1}/${w.waves.length}  ·  ${w.parried}/${w.total}`, W / 2, 41, 22, INK, 'center', FONT_UI, 0);
  },
};
