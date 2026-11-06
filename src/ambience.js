// Atmosphere helpers: dust motes, light shafts and blurred foreground props.
import { G, W, H, INK } from './core.js';

const motes = Array.from({ length: 46 }, (_, i) => ({ x: (i * 211) % W, y: (i * 137) % H, s: 0.5 + ((i * 37) % 10) / 10, p: i }));
export function dustMotes(ctx, color = 'rgba(255,240,200,.5)', count = 46) {
  ctx.save(); ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const m = motes[i];
    const x = (m.x + G.time * 14 * m.s + Math.sin(G.time * 0.7 + m.p) * 30) % W;
    const y = (m.y - G.time * 8 * m.s + H * 10) % H;
    ctx.globalAlpha = 0.35 + Math.sin(G.time * 2 + m.p) * 0.25;
    ctx.beginPath(); ctx.arc(x, y, 1.4 + m.s * 1.6, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// Soft diagonal shafts of light from a window or spotlight.
export function lightShafts(ctx, shafts) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const s of shafts) {
    const flick = 0.85 + Math.sin(G.time * 1.3 + s.x) * 0.15;
    const g = ctx.createLinearGradient(s.x, s.y, s.x + s.dx, s.y + s.len);
    g.addColorStop(0, `rgba(255,230,170,${(s.a || 0.12) * flick})`); g.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(s.x - s.w / 2, s.y); ctx.lineTo(s.x + s.w / 2, s.y);
    ctx.lineTo(s.x + s.dx + s.w, s.y + s.len); ctx.lineTo(s.x + s.dx - s.w, s.y + s.len); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Foreground props are drawn once into a blurred cache, then swayed gently.
const fgCache = new Map();
export function fgProps(ctx, key, drawFn, blur = 3.5, sway = 4) {
  let c = fgCache.get(key);
  if (!c) {
    const raw = document.createElement('canvas'); raw.width = W; raw.height = H;
    drawFn(raw.getContext('2d'));
    c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.filter = `blur(${blur}px)`; g.drawImage(raw, 0, 0);
    fgCache.set(key, c);
  }
  ctx.drawImage(c, Math.sin(G.time * 0.6) * sway, Math.cos(G.time * 0.5) * sway * 0.4);
}

export function vignetteGlow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore();
}
