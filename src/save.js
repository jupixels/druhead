// Three save slots in localStorage.
import { G } from './core.js';

const KEY = (i) => `drunkhead_slot_${i}`;

export function newSave() {
  return {
    v: 1,
    coins: 0,
    weapons: ['beer', 'whiskey'],
    trinkets: ['none'],
    supers: ['lastcall'],
    loadout: [
      { weapons: ['beer', 'whiskey'], super: 'lastcall', trinket: 'none' },
      { weapons: ['beer', 'whiskey'], super: 'lastcall', trinket: 'none' },
    ],
    beaten: {},       // levelId -> { grade, diff }
    iou: {},          // bossId -> true (beaten on Regular or harder)
    coinsFound: {},   // "levelId:i" -> true
    npcCoins: {},
    storySeen: false,
    map: { x: 180, y: 560 },
    world: 1,
    playTime: 0,
    bwUnlocked: false,
  };
}

export function loadSlot(i) {
  try {
    const raw = localStorage.getItem(KEY(i));
    if (!raw) return null;
    const s = Object.assign(newSave(), JSON.parse(raw));
    return s;
  } catch (_) { return null; }
}
export function writeSave() {
  if (!G.save) return;
  try { localStorage.setItem(KEY(G.slot), JSON.stringify(G.save)); } catch (_) {}
}
export function deleteSlot(i) { try { localStorage.removeItem(KEY(i)); } catch (_) {} }

export function loadSettings() {
  try { Object.assign(G.settings, JSON.parse(localStorage.getItem('drunkhead_settings') || '{}')); } catch (_) {}
}
export function saveSettings() { try { localStorage.setItem('drunkhead_settings', JSON.stringify(G.settings)); } catch (_) {} }

export function iouCount(s = G.save) { return Object.keys(s.iou || {}).length; }
export function completion(s) {
  const n = Object.keys(s.beaten).length;
  return Math.round((n / 10) * 100);
}
