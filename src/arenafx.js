// Extra atmosphere layered onto each arena: light, dust, haze and blurred foreground props.
import { G, W, H, INK, GROUND } from './core.js';
import { circle, ellipse, roundRect, poly } from './draw.js';
import { dustMotes, lightShafts, fgProps, vignetteGlow } from './ambience.js';

function after(def, key, fn) {
  const prev = def[key];
  def[key] = function (ctx, w) { if (prev) prev.call(this, ctx, w); fn(ctx, w); };
}
const bottle = (g, x, y, s, col) => {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 6;
  g.beginPath(); g.roundRect(-40, -170, 80, 170, 18); g.fill(); g.stroke();
  g.beginPath(); g.roundRect(-16, -240, 32, 80, 8); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-28, -160, 12, 140);
  g.restore();
};

export function decorate(L) {
  // Hops Hall: sunbeams through the arched windows, dusty air, blurred barrels up front.
  after(L.hops, 'drawBg', (ctx) => lightShafts(ctx, [{ x: 180, y: 110, w: 120, dx: 140, len: 560 }, { x: 640, y: 110, w: 120, dx: 140, len: 560 }, { x: 1100, y: 110, w: 120, dx: 140, len: 560 }]));
  after(L.hops, 'drawFg', (ctx) => {
    dustMotes(ctx, 'rgba(255,235,190,.7)');
    fgProps(ctx, 'hops', (g) => { bottle(g, -10, H + 40, 1.1, '#2f5e2c'); bottle(g, W + 20, H + 60, 1.2, '#7a3a10'); });
  });
  // Opera house: drifting dust in the spotlight, blurred footlights and curtain tassels.
  after(L.merlot, 'drawFg', (ctx) => {
    dustMotes(ctx, 'rgba(255,240,200,.6)', 30);
    fgProps(ctx, 'merlot', (g) => {
      g.fillStyle = '#5a0a14'; g.strokeStyle = INK; g.lineWidth = 6;
      g.beginPath(); g.moveTo(-20, 0); g.quadraticCurveTo(120, 300, 30, H); g.lineTo(-20, H); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(W + 20, 0); g.quadraticCurveTo(W - 120, 300, W - 30, H); g.lineTo(W + 20, H); g.fill(); g.stroke();
      for (let x = 60; x < W; x += 160) { g.fillStyle = 'rgba(255,230,140,.7)'; g.beginPath(); g.arc(x, H + 10, 40, Math.PI, 0); g.fill(); }
    }, 4, 2);
  });
  // Agave Arena: heat shimmer specks and blurred cactus + camera up front.
  after(L.agave, 'drawFg', (ctx) => {
    dustMotes(ctx, 'rgba(255,220,150,.55)', 34);
    fgProps(ctx, 'agave', (g) => {
      g.fillStyle = '#4f8a3a'; g.strokeStyle = INK; g.lineWidth = 7;
      g.beginPath(); g.roundRect(-30, H - 260, 90, 320, 45); g.fill(); g.stroke();
      g.beginPath(); g.roundRect(40, H - 200, 70, 40, 20); g.fill(); g.stroke();
      g.beginPath(); g.roundRect(80, H - 260, 40, 100, 20); g.fill(); g.stroke();
      g.fillStyle = '#2a2a2a'; g.beginPath(); g.roundRect(W - 170, H - 120, 150, 110, 12); g.fill(); g.stroke();
      g.beginPath(); g.arc(W - 95, H - 66, 34, 0, 7); g.fillStyle = '#555'; g.fill(); g.stroke();
    });
  });
  // The skies: a big soft cloud occasionally drifts in front of everything.
  after(L.rum, 'drawFg', (ctx, w) => {
    const x = W + 400 - ((w.t * 160) % (W + 1400));
    ctx.save(); ctx.globalAlpha = 0.55;
    for (const [dx, dy, r] of [[0, 0, 120], [120, -40, 150], [260, 0, 110], [140, 50, 120]]) circle(ctx, x + dx, 120 + dy, r, '#fffbea', 0);
    ctx.restore();
  });
  // The Lounge: rising bubbles, neon glow, blurred martini glasses up front.
  after(L.mix, 'drawBg', (ctx) => {
    vignetteGlow(ctx, 640, 80, 420, 'rgba(255,120,220,.14)');
    for (let i = 0; i < 18; i++) { const x = (i * 97) % W, y = H - ((G.time * (30 + (i % 5) * 12) + i * 60) % H); circle(ctx, x + Math.sin(G.time * 2 + i) * 10, y, 4 + (i % 3) * 2, 'rgba(255,220,255,.25)', 1.5); }
  });
  after(L.mix, 'drawFg', (ctx) => fgProps(ctx, 'mix', (g) => {
    g.strokeStyle = INK; g.lineWidth = 7; g.fillStyle = 'rgba(220,240,255,.85)';
    for (const [x, s] of [[60, 1], [W - 70, 1.2]]) { g.save(); g.translate(x, H + 20); g.scale(s, s); g.beginPath(); g.moveTo(-90, -260); g.lineTo(90, -260); g.lineTo(0, -150); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ffd0e8'; g.beginPath(); g.moveTo(-70, -240); g.lineTo(70, -240); g.lineTo(0, -165); g.closePath(); g.fill(); g.fillStyle = 'rgba(220,240,255,.85)'; g.fillRect(-6, -150, 12, 140); g.strokeRect(-6, -150, 12, 140); circle(g, 30, -250, 16, '#8dd14f', 5); g.restore(); }
  }));
  // Last Call Saloon: a swinging chandelier, drifting haze, blurred bottles on the bar.
  after(L.tab, 'drawBg', (ctx) => {
    const a = Math.sin(G.time * 1.2) * 0.08;
    ctx.save(); ctx.translate(640, 0); ctx.rotate(a);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 120); ctx.stroke();
    ellipse(ctx, 0, 130, 110, 22, '#d9a93a', 4);
    for (let i = -3; i <= 3; i++) { roundRect(ctx, i * 32 - 4, 98, 8, 22, 2, '#f3e6c4', 2); circle(ctx, i * 32, 94, 6, '#ffe680', 0); }
    ctx.restore();
    vignetteGlow(ctx, 640 + Math.sin(a) * 130, 120, 360, 'rgba(255,210,120,.16)');
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#f3e6c4';
    for (let i = 0; i < 4; i++) { const x = ((G.time * (12 + i * 5) + i * 400) % (W + 600)) - 300; ctx.beginPath(); ctx.ellipse(x, 220 + i * 90, 320, 40, 0, 0, 7); ctx.fill(); }
    ctx.restore();
  });
  after(L.tab, 'drawFg', (ctx) => fgProps(ctx, 'tab', (g) => { bottle(g, 30, H + 70, 1.1, '#6e1430'); bottle(g, 130, H + 90, 0.9, '#d9c46a'); }));
  after(L.barfight, 'drawFg', (ctx) => {
    dustMotes(ctx, 'rgba(255,235,190,.6)', 30);
    fgProps(ctx, 'bar', (g) => { g.fillStyle = '#6b3a1a'; g.strokeStyle = INK; g.lineWidth = 7; g.save(); g.translate(W - 120, H - 40); g.rotate(0.5); g.fillRect(-80, -20, 160, 30); g.strokeRect(-80, -20, 160, 30); g.fillRect(-60, 0, 16, 110); g.strokeRect(-60, 0, 16, 110); g.restore(); });
  });
  for (const id of ['pubcrawl', 'vineyard']) after(L[id], 'drawFg', (ctx) => dustMotes(ctx, id === 'pubcrawl' ? 'rgba(255,240,200,.35)' : 'rgba(255,230,160,.5)', 26));
}
