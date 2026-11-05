// Scene routing (kept separate to avoid circular imports at load time).
import { G } from '../core.js';

export const nav = {
  _s: {},
  register(name, fn) { this._s[name] = fn; },
  title() { G.setScene(this._s.title()); },
  map() { G.setScene(this._s.map()); },
  level(id, diff) { G.setScene(this._s.level(id, diff)); },
  results(id, diff, res) { G.setScene(this._s.results(id, diff, res)); },
  shop() { G.setScene(this._s.shop()); },
  story(after) { G.setScene(this._s.story(after)); },
  ending() { G.setScene(this._s.ending()); },
};
