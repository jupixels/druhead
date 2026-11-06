// Shared boss behavior: health, phases, difficulty scaling, death sequence.
import { G, rand } from '../core.js';
import { play } from '../audio.js';

export class Boss {
  constructor(w, { hp, phases = [], name = 'Boss' }) {
    this.w = w;
    this.name = name;
    const mult = [0.8, 1, 1.15][w.diff];
    this.maxHp = hp * mult;
    this.hp = this.maxHp;
    this.phases = phases;      // fractions of HP remaining where a new phase starts, e.g. [0.66, 0.33]
    this.phase = 0;
    this.spd = [0.8, 1, 1.22][w.diff];
    this.hitT = 0;
    this.dying = false;
    this.dead = false;
    this.deathT = 0;
    this.t = 0;
    this.act = 'idle'; this.actT = 0; this.lastAct = null;
    this.invulnerable = false;
  }
  // Light difficulty skips the final phase.
  get endFrac() { return this.w.diff === 0 && this.phases.length ? this.phases[this.phases.length - 1] : 0; }
  setAct(a) { this.act = a; this.actT = 0; this.step = 0; }
  chooseAct(list) {
    const opts = list.filter((a) => a !== this.lastAct || list.length === 1);
    const a = opts[Math.floor(Math.random() * opts.length)];
    this.lastAct = a; this.setAct(a);
  }
  takeDamage(d, w) {
    if (this.invulnerable || this.dying) return;
    this.hp -= d;
    this.hitT = 0.06;
    play('boss_hit', { cooldown: 0.11, vary: 0.15 });
    const frac = this.hp / this.maxHp;
    while (this.phase < this.phases.length && frac <= this.phases[this.phase]) {
      this.phase++;
      if (frac > this.endFrac) this.onPhase && this.onPhase(this.phase, w);
    }
    if (frac <= this.endFrac) this.die(w);
  }
  die(w) {
    if (this.dying) return;
    this.dying = true; this.hp = 0;
    w.bossDefeated();
  }
  hitboxes() { return []; }
  deathUpdate(dt, w) {
    this.deathT += dt;
    this.t += dt;
    if (Math.random() < 0.25) {
      const r = this.bodyRect ? this.bodyRect() : { x: 900, y: 300, w: 200, h: 300 };
      w.explode(r.x + rand(0, r.w), r.y + rand(0, r.h), rand(0.5, 1.1));
      if (Math.random() < 0.3) play('boss_explode', { vary: 0.2, volume: 0.5, cooldown: 0.15 });
    }
    G.shake = Math.max(G.shake, 4);
  }
}
