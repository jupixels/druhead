// Core constants and helpers shared by everything.
export const W = 1280, H = 720;
export const GROUND = 630;
export const INK = '#1b120a';
export const PAPER = '#f3e6c4';
export const PINK = '#ff5fa8';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const sign = (v) => (v < 0 ? -1 : 1);
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const ease = (t) => t * t * (3 - 2 * t);

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function circleRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x, b.x + b.w), ny = clamp(cy, b.y, b.y + b.h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

// Global game state (scene manager + shared data).
export const G = {
  canvas: null,
  ctx: null,
  time: 0,        // seconds since boot
  frame: 0,
  boil: 0,        // changes ~12x per second, drives line "boil" wobble
  scene: null,
  save: null,
  slot: 0,
  coop: false,
  settings: { bw: false, filter: true, volume: 0.8, music: 0.45, shake: true },
  hitstop: 0,
  shake: 0,
  setScene(s) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = s;
    if (s.enter) s.enter();
  },
};

// Deterministic per-boil wobble so outlines jitter like hand-drawn animation.
export function wob(i, amt = 1.2) {
  const s = Math.sin(i * 12.9898 + G.boil * 78.233) * 43758.5453;
  return (s - Math.floor(s) - 0.5) * 2 * amt;
}
