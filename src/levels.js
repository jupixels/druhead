// Registry of every playable level.
import { hopsLevel } from './bosses/hops.js';
import { merlotLevel } from './bosses/merlot.js';
import { agaveLevel } from './bosses/agave.js';
import { rumLevel } from './bosses/rum.js';
import { mixLevel } from './bosses/mix.js';
import { tabLevel } from './bosses/tab.js';
import { pubcrawlLevel, vineyardLevel } from './runlevels.js';
import { barfightLevel } from './barfight.js';

export const LEVELS = {
  hops: hopsLevel,
  merlot: merlotLevel,
  agave: agaveLevel,
  rum: rumLevel,
  mix: mixLevel,
  tab: tabLevel,
  pubcrawl: pubcrawlLevel,
  vineyard: vineyardLevel,
  barfight: barfightLevel,
};

// Cuphead-style grading.
export function gradeFor(world) {
  const def = world.def;
  const par = def.par || 120;
  const t = world.stats.time;
  let score = 0;
  // Time (20)
  score += t <= par ? 20 : Math.max(0, 20 * (1 - (t - par) / par));
  // Health left (30) — averaged across players
  const ps = world.players;
  const hits = ps.reduce((a, p) => a + p.stats.hits, 0) / ps.length;
  score += Math.max(0, 30 - hits * 10);
  // Parries (25) — 3 needed, shared in co-op
  const parries = ps.reduce((a, p) => a + p.stats.parries, 0);
  score += Math.min(3, parries) / 3 * 25;
  // Super meter use (25) — EX = 1 card, Super = 5 cards, 6 cards needed
  const cards = ps.reduce((a, p) => a + p.stats.ex + p.stats.supers * 5, 0);
  score += Math.min(6, cards) / 6 * 25;
  const diff = world.diff;
  let grade;
  if (diff === 2 && score >= 99) grade = 'S';
  else if (score >= 95) grade = 'A+';
  else if (score >= 90) grade = 'A';
  else if (score >= 85) grade = 'A-';
  else if (score >= 80) grade = 'B+';
  else if (score >= 75) grade = 'B';
  else if (score >= 70) grade = 'B-';
  else if (score >= 65) grade = 'C+';
  else if (score >= 60) grade = 'C';
  else if (score >= 55) grade = 'C-';
  else grade = 'D';
  if (diff === 0 && GRADES.indexOf(grade) < GRADES.indexOf('B+')) grade = 'B+'; // Light caps at B+
  return { grade, score, time: t, hits, parries, cards, par };
}
export const GRADES = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D'];
export function betterGrade(a, b) { if (!a) return b; if (!b) return a; return GRADES.indexOf(a) <= GRADES.indexOf(b) ? a : b; }
