// Hand-drawn "rubber hose" cartoon drawing helpers.
import { G, INK, wob } from './core.js';

export const FONT_TITLE = '"Rye", "Georgia", serif';
export const FONT_UI = '"Alegreya Sans SC", "Trebuchet MS", sans-serif';

export function ellipse(ctx, x, y, rx, ry, fill, lw = 3, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}
export function circle(ctx, x, y, r, fill, lw = 3) { ellipse(ctx, x, y, r, r, fill, lw); }

export function poly(ctx, pts, fill, lw = 3, seed = 0) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = p[0] + wob(seed + i, 0.8), y = p[1] + wob(seed + i + 50, 0.8);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(); }
}

export function roundRect(ctx, x, y, w, h, r, fill, lw = 3) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}

// Rubber-hose limb: ink outline, then colored core.
export function hose(ctx, x1, y1, cx, cy, x2, y2, w, color) {
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.strokeStyle = INK; ctx.lineWidth = w + 5; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
}

// Classic pie-cut eye.
export function pieEye(ctx, x, y, rx, ry, look = 0, blink = false) {
  if (blink) {
    ctx.beginPath(); ctx.moveTo(x - rx, y); ctx.quadraticCurveTo(x, y + ry * 0.5, x + rx, y);
    ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); return;
  }
  ellipse(ctx, x, y, rx, ry, '#fff', 2.5);
  const px = x + Math.cos(look) * rx * 0.25, py = y + Math.sin(look) * ry * 0.2;
  ctx.beginPath();
  ctx.ellipse(px, py, rx * 0.72, ry * 0.8, 0, -Math.PI * 0.32, Math.PI * 1.55);
  ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fillStyle = INK; ctx.fill();
}

export function glove(ctx, x, y, r, ang = 0, point = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  if (point) {
    roundRect(ctx, r * 0.3, -r * 0.28, r * 1.3, r * 0.56, r * 0.28, '#fff', 2.5);
  }
  ellipse(ctx, 0, 0, r, r * 0.9, '#fff', 0);
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.9, 0, 0, 7); shadePath(ctx, 0, 0, r, 0.8);
  ellipse(ctx, 0, 0, r, r * 0.9, null, 2.5);
  ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.5); ctx.lineTo(-r * 0.1, r * 0.1);
  ctx.moveTo(r * 0.25, -r * 0.55); ctx.lineTo(r * 0.3, 0);
  ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}

export function shoe(ctx, x, y, dir = 1, color = '#3a2414', s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s);
  ellipse(ctx, 6, -7, 16, 9.5, color, 0);
  ctx.beginPath(); ctx.ellipse(6, -7, 16, 9.5, 0, 0, 7); shadePath(ctx, 6, -7, 16, 1.2);
  ellipse(ctx, 6, -7, 16, 9.5, null, 3);
  ellipse(ctx, 13, -11, 5, 2.5, 'rgba(255,255,255,.55)', 0);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-9, -3, 30, 3);
  ctx.restore();
}

// Outlined text.
export function text(ctx, str, x, y, size = 32, fill = '#fff', align = 'center', font = FONT_TITLE, outline = 6) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (outline) { ctx.lineWidth = outline; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = fill; ctx.fillText(str, x, y);
}

export function starburst(ctx, x, y, r, n, fill, rot = 0, lw = 3) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.5 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
}

// A cheerful rubber-hose mouth.
export function mouth(ctx, x, y, w, open = 0, fill = '#7a1c1c') {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x, y + w * (0.7 + open), x + w, y);
  if (open > 0.05) {
    ctx.quadraticCurveTo(x, y + w * 0.2, x - w, y);
    ctx.fillStyle = fill; ctx.fill();
  }
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
}

// Paper-cut style panel used by menus.
export function panel(ctx, x, y, w, h, fill = '#f3e6c4') {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(x + 10, y + 12, w, h);
  roundRect(ctx, x, y, w, h, 14, fill, 5);
  ctx.strokeStyle = 'rgba(27,18,10,.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x + 10, y + 10, w - 20, h - 20, 10); ctx.stroke();
  ctx.restore();
}

// Drink card for the super meter.
export function card(ctx, x, y, fill01, active) {
  const w = 18, h = 26;
  roundRect(ctx, x, y, w, h, 3, '#3b2a1c', 2);
  if (fill01 > 0) {
    const fh = (h - 4) * fill01;
    ctx.fillStyle = active ? (Math.floor(G.time * 8) % 2 ? '#ffe680' : '#ffcc33') : '#c99a3a';
    ctx.fillRect(x + 2, y + h - 2 - fh, w - 4, fh);
  }
  if (fill01 >= 1) { ctx.fillStyle = '#fff'; ctx.fillRect(x + 4, y + 4, 3, 8); }
}

// Soft cartoon shading for a shape already traced as the current path:
// a warm highlight up-left and a cool shadow down-right, clipped to the shape.
export function shadePath(ctx, x, y, r, strength = 1) {
  ctx.save();
  ctx.clip();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r * 1.25);
  g.addColorStop(0, `rgba(255,250,235,${0.42 * strength})`);
  g.addColorStop(0.45, 'rgba(255,250,235,0)');
  g.addColorStop(0.75, 'rgba(40,15,0,0)');
  g.addColorStop(1, `rgba(40,15,0,${0.38 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  ctx.restore();
}
// Filled + shaded + inked ellipse in one call.
export function blob(ctx, x, y, rx, ry, fill, lw = 3.5, strength = 1, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  shadePath(ctx, x, y, Math.max(rx, ry), strength);
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
}
// Shaded rounded rect.
export function sbox(ctx, x, y, w, h, r, fill, lw = 3.5, strength = 1) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill; ctx.fill();
  shadePath(ctx, x + w / 2, y + h / 2, Math.max(w, h) / 2, strength);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
}
