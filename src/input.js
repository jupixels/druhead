// Keyboard + gamepad input. Two players can share one keyboard:
// Player 1 uses the left half, Player 2 the right half. In single player,
// Player 1 can use either half (and gamepad 1).
import { G } from './core.js';

export const ACTIONS = ['up', 'down', 'left', 'right', 'jump', 'shoot', 'dash', 'ex', 'swap', 'lock'];

export const DEFAULT_BINDS = {
  left: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'KeyV', shoot: 'KeyC', dash: 'KeyB', ex: 'KeyF', swap: 'KeyG', lock: 'ShiftLeft' },
  right: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', jump: 'KeyK', shoot: 'KeyJ', dash: 'KeyL', ex: 'KeyI', swap: 'KeyO', lock: 'ShiftRight' },
};

export const binds = JSON.parse(JSON.stringify(DEFAULT_BINDS));
try {
  const saved = JSON.parse(localStorage.getItem('drunkhead_binds') || 'null');
  if (saved) for (const side of ['left', 'right']) Object.assign(binds[side], saved[side] || {});
} catch (_) {}
export function saveBinds() { try { localStorage.setItem('drunkhead_binds', JSON.stringify(binds)); } catch (_) {} }
export function resetBinds() { for (const s of ['left', 'right']) Object.assign(binds[s], DEFAULT_BINDS[s]); saveBinds(); }

const keys = new Set();
const tapped = new Set(); // keys pressed since the last poll (so quick taps are never missed)
const has = (c) => keys.has(c) || tapped.has(c);
let lastKey = null; // for rebinding
const swallow = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);
addEventListener('keydown', (e) => {
  if (swallow.has(e.code)) e.preventDefault();
  if (!e.repeat) lastKey = e.code;
  keys.add(e.code); tapped.add(e.code);
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); tapped.clear(); });

export function takeLastKey() { const k = lastKey; lastKey = null; return k; }

function mkState() {
  const s = { held: {}, pressed: {}, released: {}, ax: 0, ay: 0, device: 'keys' };
  for (const a of ACTIONS) { s.held[a] = false; s.pressed[a] = false; s.released[a] = false; }
  return s;
}
export const players = [mkState(), mkState()];
export const menu = { up: false, down: false, left: false, right: false, confirm: false, back: false, pause: false, any: false };
const prevMenu = {};
const PAD = { jump: [0], shoot: [2], ex: [3, 1], dash: [5, 7], swap: [4], lock: [6] };

function padFor(i) {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  return pads[i] || null;
}

export function pollInput() {
  for (let i = 0; i < 2; i++) {
    const st = players[i];
    const sides = G.coop ? [i === 0 ? 'left' : 'right'] : i === 0 ? ['left', 'right'] : [];
    const now = {};
    for (const a of ACTIONS) now[a] = sides.some((s) => has(binds[s][a]));
    if (i === 0 && !G.coop && has('Space')) now.jump = true;
    const pad = padFor(i);
    if (pad) {
      const b = (n) => pad.buttons[n] && pad.buttons[n].pressed;
      for (const a in PAD) if (PAD[a].some(b)) now[a] = true;
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (ax < -0.45 || b(14)) now.left = true;
      if (ax > 0.45 || b(15)) now.right = true;
      if (ay < -0.5 || b(12)) now.up = true;
      if (ay > 0.5 || b(13)) now.down = true;
    }
    for (const a of ACTIONS) {
      st.pressed[a] = now[a] && !st.held[a];
      st.released[a] = !now[a] && st.held[a];
      st.held[a] = now[a];
    }
    st.ax = (now.right ? 1 : 0) - (now.left ? 1 : 0);
    st.ay = (now.down ? 1 : 0) - (now.up ? 1 : 0);
  }
  // Menu input: anything from anyone.
  const m = {
    up: has('ArrowUp') || has('KeyW') || players[0].held.up || players[1].held.up,
    down: has('ArrowDown') || has('KeyS') || players[0].held.down || players[1].held.down,
    left: has('ArrowLeft') || has('KeyA') || players[0].held.left || players[1].held.left,
    right: has('ArrowRight') || has('KeyD') || players[0].held.right || players[1].held.right,
    confirm: has('Enter') || has('Space') || has('KeyV') || has('KeyK') || has('KeyZ') || padBtn(0),
    back: has('Escape') || has('Backspace') || has('KeyB') || has('KeyL') || has('KeyX') || padBtn(1),
    pause: has('Escape') || has('KeyP') || padBtn(9),
  };
  menu.any = false;
  for (const k in m) {
    menu[k] = m[k] && !prevMenu[k];
    if (menu[k]) menu.any = true;
    prevMenu[k] = m[k];
  }
  tapped.clear();
}
function padBtn(n) {
  for (let i = 0; i < 2; i++) { const p = padFor(i); if (p && p.buttons[n] && p.buttons[n].pressed) return true; }
  return false;
}
export function keyName(code) {
  if (!code) return '—';
  const sp = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl', AltLeft: 'L-Alt', AltRight: 'R-Alt', Semicolon: ';', Comma: ',', Period: '.', Slash: '/', Quote: "'", BracketLeft: '[', BracketRight: ']' };
  return sp[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}
