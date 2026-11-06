// Audio: thin wrapper over lib/sfx.js. All sound and music files live in
// sounds/sfx and sounds/music (generated with ElevenLabs). Missing files are
// simply silent, so the game runs fine before the audio exists.
import { G } from './core.js';

export const SFX_LIST = {
  shoot_beer: 0.35, shoot_whiskey: 0.4, shoot_wine: 0.35, shoot_champ: 0.45, charge_up: 0.4, shoot_tequila: 0.55,
  shoot_vodka: 0.4, ex_shot: 0.7, super_beam: 0.8, super_invincible: 0.7, super_ghost: 0.7,
  jump: 0.35, land: 0.3, dash: 0.45, parry: 0.8, player_hit: 0.8, player_die: 0.8, revive: 0.7,
  boss_hit: 0.18, boss_explode: 0.9, enemy_pop: 0.5, announcer_start: 0.9, announcer_ko: 0.9, announcer_lose: 0.8,
  coin: 0.6, menu_move: 0.35, menu_select: 0.5, menu_back: 0.4, card_ready: 0.5, glass_shatter: 0.6,
  cork_pop: 0.55, splash: 0.5, whoosh: 0.5, slam: 0.8, buy: 0.6, stamp: 0.8, step: 0.25, burp: 0.7, roar: 0.8,
  bell: 0.6, plane_shoot: 0.3, bomb: 0.6, ice: 0.5,
};
export const MUSIC_LIST = ['title', 'map', 'shop', 'boss_hops', 'boss_merlot', 'boss_agave', 'boss_rum', 'boss_mix', 'boss_tab', 'run', 'barfight', 'results', 'story'];

let sfx = null;
let loaded = false;
let currentMusic = null;

export async function initAudio() {
  if (!window.SFX || sfx) return;
  sfx = new window.SFX({ base: 'sounds/' });
  const map = {};
  for (const [n, v] of Object.entries(SFX_LIST)) map[n] = { src: `sfx/${n}.mp3`, volume: v };
  for (const n of MUSIC_LIST) map['m_' + n] = { src: `music/${n}.mp3`, volume: 1 };
  // Silence the missing-file warnings: probe a manifest first.
  try {
    const res = await fetch('sounds/manifest.json');
    if (res.ok) {
      const have = new Set(await res.json());
      for (const k of Object.keys(map)) if (!have.has(map[k].src)) delete map[k];
    } else return;
  } catch (_) { return; }
  await sfx.load(map);
  loaded = true;
  applyVolume();
  if (currentMusic) { const m = currentMusic; currentMusic = null; playMusic(m); }
}

let duck = 1;
export function applyVolume() {
  if (!sfx) return;
  sfx.setVolume('master', G.settings.volume);
  sfx.setVolume('music', G.settings.music * duck);
}
// Lower the music while paused or in menus layered over gameplay.
export function duckMusic(on) { duck = on ? 0.35 : 1; applyVolume(); }

export function play(name, opts = {}) {
  if (!loaded || !sfx.buffers[name]) return null;
  return sfx.play(name, opts);
}
export function loopSfx(name, opts = {}) {
  if (!loaded || !sfx.buffers[name]) return null;
  return sfx.loop(name, opts);
}
export function playMusic(name) {
  if (currentMusic === name) return;
  currentMusic = name;
  if (!loaded) return;
  if (!name || !sfx.buffers['m_' + name]) { sfx.music(null); return; }
  sfx.music('m_' + name, { crossfade: 0.8 });
}
export function stopMusic() { currentMusic = null; if (loaded) sfx.music(null); }
