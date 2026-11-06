// Old-film look: grain, flicker, scratches, dust, vignette, and iris transitions.
import { G, W, H, INK, rand } from './core.js';

const grainFrames = [];
function makeGrain() {
  for (let f = 0; f < 6; f++) {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    const g = c.getContext('2d');
    const img = g.createImageData(320, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < 0.5 ? 18 : 0;
    }
    g.putImageData(img, 0, 0);
    grainFrames.push(c);
  }
}
let vignette = null;
function makeVignette() {
  vignette = document.createElement('canvas');
  vignette.width = W; vignette.height = H;
  const g = vignette.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(20,10,0,0.5)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
}

const scratches = [];
const dust = [];

export function initFx() { makeGrain(); makeVignette(); }

export function drawFilm(ctx) {
  if (!G.settings.filter) return;
  // Warm wash
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgba(255,236,200,0.08)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // Grain
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const gf = grainFrames[Math.floor(G.time * 24) % grainFrames.length];
  ctx.globalAlpha = 0.9;
  ctx.drawImage(gf, 0, 0, W, H);
  ctx.restore();
  // Scratches
  if (Math.random() < 0.06) scratches.push({ x: rand(0, W), life: rand(0.1, 0.5), w: rand(0.6, 1.8) });
  ctx.save();
  for (let i = scratches.length - 1; i >= 0; i--) {
    const s = scratches[i];
    s.life -= 1 / 60; s.x += rand(-2, 2);
    if (s.life <= 0) { scratches.splice(i, 1); continue; }
    ctx.strokeStyle = Math.random() < 0.5 ? 'rgba(255,250,235,.35)' : 'rgba(30,20,10,.35)';
    ctx.lineWidth = s.w;
    ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x + rand(-6, 6), H); ctx.stroke();
  }
  // Dust specks and hairs
  if (Math.random() < 0.25) dust.push({ x: rand(0, W), y: rand(0, H), r: rand(1, 3.5), life: 2 / 60, hair: Math.random() < 0.15, a: rand(0, 6) });
  for (let i = dust.length - 1; i >= 0; i--) {
    const d = dust[i];
    d.life -= 1 / 60;
    if (d.life <= 0) { dust.splice(i, 1); continue; }
    ctx.fillStyle = ctx.strokeStyle = 'rgba(20,12,5,.55)';
    if (d.hair) {
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(d.x, d.y);
      ctx.quadraticCurveTo(d.x + 20 * Math.cos(d.a), d.y + 20, d.x + 30 * Math.sin(d.a), d.y + 34); ctx.stroke();
    } else { ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  // Flicker + vignette
  ctx.drawImage(vignette, 0, 0);
  const fl = 0.04 + Math.sin(G.time * 37) * 0.015 + (Math.random() < 0.03 ? 0.05 : 0);
  ctx.fillStyle = `rgba(255,245,220,${fl * 0.5})`;
  ctx.fillRect(0, 0, W, H);
}

// Iris transition (circle closes, callback, circle opens).
export const iris = {
  t: 0, dir: 0, cb: null, cx: W / 2, cy: H / 2,
  close(cb, cx = W / 2, cy = H / 2) {
    if (this.dir === 1) return;
    this.dir = 1; this.t = 0; this.cb = cb; this.cx = cx; this.cy = cy;
  },
  update(dt) {
    if (this.dir === 1) {
      this.t += dt * 2.4;
      if (this.t >= 1) { this.t = 1; this.dir = -1; const cb = this.cb; this.cb = null; this.cx = W / 2; this.cy = H / 2; cb && cb(); }
    } else if (this.dir === -1) {
      this.t -= dt * 2.2;
      if (this.t <= 0) { this.t = 0; this.dir = 0; }
    }
  },
  busy() { return this.dir !== 0; },
  draw(ctx) {
    if (this.t <= 0) return;
    const maxR = Math.hypot(W, H);
    const r = maxR * (1 - this.t) * (1 - this.t);
    ctx.save();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(this.cx, this.cy, Math.max(0, r), 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();
  },
};

// ---------- Painterly treatment for backgrounds ----------
let wcTex = null;
export function watercolorTex() {
  if (wcTex) return wcTex;
  wcTex = document.createElement('canvas'); wcTex.width = W; wcTex.height = H;
  const g = wcTex.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  // Soft pigment blooms
  for (let i = 0; i < 260; i++) {
    const x = rand(0, W), y = rand(0, H), r = rand(30, 180);
    const grad = g.createRadialGradient(x, y, r * 0.2, x, y, r);
    const tone = Math.random() < 0.5 ? '120,80,40' : '90,60,50';
    const a = rand(0.025, 0.07);
    grad.addColorStop(0, `rgba(${tone},${a})`); grad.addColorStop(0.7, `rgba(${tone},${a * 0.6})`); grad.addColorStop(1, `rgba(${tone},0)`);
    g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Paper fibers
  g.strokeStyle = 'rgba(90,60,30,.06)'; g.lineWidth = 1;
  for (let i = 0; i < 900; i++) { const x = rand(0, W), y = rand(0, H), a = rand(0, 6.28), l = rand(4, 16); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  // Baked inner edge darkening
  const v = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.9);
  v.addColorStop(0, 'rgba(60,30,10,0)'); v.addColorStop(1, 'rgba(60,30,10,.22)');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  return wcTex;
}
export function paintify(c) {
  const out = document.createElement('canvas'); out.width = c.width; out.height = c.height;
  const g = out.getContext('2d');
  g.filter = 'blur(0.9px) saturate(1.06)'; g.drawImage(c, 0, 0); g.filter = 'none';
  g.globalCompositeOperation = 'multiply'; g.drawImage(watercolorTex(), 0, 0);
  g.globalCompositeOperation = 'source-over';
  return out;
}
