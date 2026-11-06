// The Tipsy Isles overworld.
import { G, W, H, INK, PINK, clamp, rand } from '../core.js';
import { ellipse, circle, poly, roundRect, text, panel, starburst, pieEye, mouth, FONT_TITLE, FONT_UI } from '../draw.js';
import { players as INPUTS, menu } from '../input.js';
import { Menu } from '../ui.js';
import { iris } from '../fx.js';
import { play, playMusic } from '../audio.js';
import { Player } from '../player.js';
import { writeSave, iouCount } from '../save.js';
import { LEVELS } from '../levels.js';
import { DIFFS } from '../world.js';
import { WEAPONS, WEAPON_ORDER, SUPERS, TRINKETS } from '../weapons.js';
import { nav } from './nav.js';

const MW = 2700, MH = 1600;
const ISLANDS = [
  { x: 560, y: 880, rx: 470, ry: 400, seed: 1 },
  { x: 1480, y: 820, rx: 360, ry: 330, seed: 2 },
  { x: 2260, y: 760, rx: 330, ry: 360, seed: 3 },
];
const BRIDGES = [
  { x: 990, y: 830, w: 170, h: 60, need: (s) => s.beaten.hops && s.beaten.merlot, hint: 'Beat Sir Hops-a-Lot and Madame Merlot to lower this bridge.' },
  { x: 1800, y: 760, w: 170, h: 60, need: (s) => !!s.beaten.agave, hint: 'Beat The Agave Brothers to lower this bridge.' },
];
export const NODES = [
  { id: 'tab', x: 330, y: 1080, kind: 'saloon', label: 'The Last Call Saloon', need: (s) => iouCount(s) >= 5, hint: 'Big Tab won\'t see you until you bring all 5 IOUs.' },
  { id: 'hops', x: 660, y: 640, kind: 'brewery', label: 'Hops Hall' },
  { id: 'merlot', x: 850, y: 1020, kind: 'opera', label: 'Merlot Opera House' },
  { id: 'pubcrawl', x: 330, y: 700, kind: 'street', label: 'Pub Crawl' },
  { id: 'shop', x: 580, y: 1170, kind: 'shop', label: "Barley's Back Room" },
  { id: 'tutorial', x: 560, y: 860, kind: 'practice', label: 'The Practice Bar' },
  { id: 'agave', x: 1500, y: 620, kind: 'arena', label: 'Agave Arena' },
  { id: 'vineyard', x: 1680, y: 930, kind: 'vineyard', label: 'Vineyard Dash' },
  { id: 'barfight', x: 1310, y: 980, kind: 'tavern', label: 'The Bar Fight' },
  { id: 'rum', x: 2140, y: 990, kind: 'airfield', label: 'Rum Runner Airfield' },
  { id: 'mix', x: 2340, y: 540, kind: 'lounge', label: 'The Mixologist\'s Lounge' },
];
const NPCS = [
  { id: 'otis', x: 380, y: 900, name: 'Old Sot Otis', look: 'bottle', color: '#5a7a2a', coin: true,
    lines: ['Hic! Welcome to the Tipsy Isles, kid.', 'New in town? Stop by the Practice Bar next door and learn the ropes first.', 'See somethin\' PINK flyin\' at ya? Jump, then press jump AGAIN while touchin\' it. That\'s a parry!', 'Parries fill your drink cards. Spend a card on an EX shot... or save all five for a Super!', 'Here, take this coin. Barley sells good stuff in his Back Room.'] },
  { id: 'lou', x: 940, y: 800, name: 'Lemon Lou', look: 'lemon', color: '#ffe14a', coin: false,
    lines: ['The bridge keeper won\'t lower that bridge till you show Hops and Merlot who\'s boss.', 'Hold LOCK to stand still and aim in any direction. Real handy!'] },
  { id: 'sally', x: 1430, y: 760, name: 'Sober Sally', look: 'water', color: '#9fd8ff', coin: true,
    lines: ['Oh, I don\'t drink. I just come for the fights.', 'Win the Bar Fight over yonder and you\'ll learn a brand new Super. On Top Shelf? Even better.', 'Here, I found this coin in a spittoon. Don\'t ask.'] },
  { id: 'tom', x: 2190, y: 770, name: 'Tipsy Tom', look: 'tumbler', color: '#c9762a', coin: true,
    lines: ['Big Tab owns every barstool on these isles.', 'They say when you\'re hit with one heart left, the screen flashes your HP card red. Dash through bullets? Only with a Coaster, pal.', 'Take a coin for the road!'] },
];
const HIDDEN = [
  { id: 'm1', x: 160, y: 900 }, { id: 'm2', x: 1250, y: 620 }, { id: 'm3', x: 1720, y: 640 }, { id: 'm4', x: 2480, y: 840 },
];

function onIsland(x, y) {
  for (const i of ISLANDS) { const dx = (x - i.x) / (i.rx * 0.9), dy = (y - i.y) / (i.ry * 0.9); if (dx * dx + dy * dy < 1) return true; }
  for (const b of BRIDGES) if (b.need(G.save) && x > b.x - 30 && x < b.x + b.w + 30 && y > b.y && y < b.y + b.h) return true;
  return false;
}

export class MapScene {
  constructor() {
    const s = G.save;
    this.tokens = [];
    const n = G.coop ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const p = new Player(i, s.map.x + i * 40, s.map.y, s.loadout[i]);
      p.onGround = true;
      this.tokens.push(p);
    }
    this.cam = { x: s.map.x - W / 2, y: s.map.y - H / 2 };
    this.mode = 'walk';
    this.near = null;
    this.t = 0;
    this.stepT = 0;
    this.dialog = null;
  }
  enter() { playMusic('map'); }

  update(dt) {
    this.t += dt;
    if (iris.busy()) return;
    if (this.mode === 'card') return this.updateCard();
    if (this.mode === 'equip') return this.updateEquip();
    if (this.mode === 'pause') { this.pauseMenu.update(); return; }
    if (this.mode === 'talk') return this.updateTalk();
    // Walk
    let moving = false;
    for (const p of this.tokens) {
      const inp = INPUTS[p.idx];
      let ax = inp.ax, ay = inp.ay;
      const l = Math.hypot(ax, ay) || 1;
      const sp = 230;
      const nx = p.x + (ax / l) * sp * dt, ny = p.y + (ay / l) * sp * dt;
      if (onIsland(nx, ny)) { p.x = nx; p.y = ny; } else if (onIsland(nx, p.y)) p.x = nx; else if (onIsland(p.x, ny)) p.y = ny;
      if (ax) p.facing = Math.sign(ax);
      p.vx = ax || ay ? 100 : 0;
      p.anim += dt;
      if (ax || ay) moving = true;
      p.aimX = p.facing; p.aimY = 0;
    }
    // Keep co-op tokens on screen together
    if (this.tokens.length === 2) {
      const [a, b] = this.tokens;
      if (Math.abs(a.x - b.x) > W - 200) { const m = (a.x + b.x) / 2; a.x = clamp(a.x, m - (W - 200) / 2, m + (W - 200) / 2); b.x = clamp(b.x, m - (W - 200) / 2, m + (W - 200) / 2); }
      if (Math.abs(a.y - b.y) > H - 200) { const m = (a.y + b.y) / 2; a.y = clamp(a.y, m - (H - 200) / 2, m + (H - 200) / 2); b.y = clamp(b.y, m - (H - 200) / 2, m + (H - 200) / 2); }
    }
    const lead = this.tokens[0];
    const cx = this.tokens.reduce((a, p) => a + p.x, 0) / this.tokens.length, cy = this.tokens.reduce((a, p) => a + p.y, 0) / this.tokens.length;
    this.cam.x += (clamp(cx - W / 2, 0, MW - W) - this.cam.x) * Math.min(1, dt * 5);
    this.cam.y += (clamp(cy - H / 2, 0, MH - H) - this.cam.y) * Math.min(1, dt * 5);
    G.save.map.x = lead.x; G.save.map.y = lead.y;

    // Hidden coins
    for (const c of HIDDEN) {
      const key = 'map:' + c.id;
      if (G.save.coinsFound[key]) continue;
      if (this.tokens.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 40)) { G.save.coinsFound[key] = true; G.save.coins++; play('coin'); writeSave(); this.toast = { str: 'Found a hidden coin!', t: 2 }; }
    }
    if (this.toast) { this.toast.t -= dt; if (this.toast.t <= 0) this.toast = null; }

    // Nearby node / NPC
    this.near = null;
    let best = 90;
    for (const nd of NODES) { const d = Math.min(...this.tokens.map((p) => Math.hypot(p.x - nd.x, p.y - (nd.y + 40)))); if (d < best) { best = d; this.near = { type: 'node', nd }; } }
    for (const np of NPCS) { const d = Math.min(...this.tokens.map((p) => Math.hypot(p.x - np.x, p.y - np.y))); if (d < Math.min(best, 70)) { best = d; this.near = { type: 'npc', np }; } }
    for (const b of BRIDGES) if (!b.need(G.save)) { const d = Math.min(...this.tokens.map((p) => Math.hypot(p.x - b.x, p.y - (b.y + 30)))); if (d < 70) this.near = { type: 'hint', str: b.hint }; }

    const pressed = (a) => this.tokens.some((p) => INPUTS[p.idx].pressed[a]);
    if ((pressed('jump') || menu.confirm) && this.near) {
      if (this.near.type === 'node') this.openNode(this.near.nd);
      else if (this.near.type === 'npc') this.openTalk(this.near.np);
      else { this.toast = { str: this.near.str, t: 3 }; play('menu_back'); }
    }
    if (pressed('ex')) this.openEquip();
    if (menu.pause) this.openPause();
  }

  // ---------- Level cards ----------
  openNode(nd) {
    const s = G.save;
    if (nd.need && !nd.need(s)) { this.toast = { str: nd.hint, t: 3 }; play('menu_back'); return; }
    if (nd.id === 'shop') { play('menu_select'); writeSave(); iris.close(() => nav.shop()); return; }
    const def = LEVELS[nd.id];
    if (!def) { this.toast = { str: 'Coming soon!', t: 2 }; return; }
    play('menu_select');
    this.mode = 'card'; this.card = nd;
    const beaten = s.beaten[nd.id];
    const go = (d) => { writeSave(); iris.close(() => nav.level(nd.id, d)); };
    const items = [];
    if (def.type === 'boss' || def.type === 'plane') {
      items.push({ label: 'Light', action: () => go(0) });
      items.push({ label: 'Regular', action: () => go(1) });
      items.push({ label: () => (beaten && beaten.diff >= 1 ? 'Top Shelf' : 'Top Shelf (beat Regular first)'), disabled: !(beaten && beaten.diff >= 1), action: () => go(2) });
    } else items.push({ label: 'Enter', action: () => go(def.type === 'parry' && beaten ? 1 : 1) });
    if (def.type === 'parry' && beaten) { items.length = 0; items.push({ label: 'Regular', action: () => go(1) }, { label: 'Top Shelf', action: () => go(2) }); }
    items.push({ label: 'Not yet', action: () => (this.mode = 'walk') });
    this.cardMenu = new Menu(items, { back: () => (this.mode = 'walk') });
    this.cardMenu.i = 1 < items.length - 1 && (def.type === 'boss' || def.type === 'plane') ? 1 : 0;
  }
  updateCard() { this.cardMenu.update(); }

  // ---------- NPC talk ----------
  openTalk(np) { this.mode = 'talk'; this.dialog = { np, i: 0 }; play('menu_select'); }
  updateTalk() {
    if (menu.confirm || this.tokens.some((p) => INPUTS[p.idx].pressed.jump)) {
      const d = this.dialog;
      d.i++;
      play('menu_move');
      if (d.i >= d.np.lines.length) {
        if (d.np.coin && !G.save.npcCoins[d.np.id]) { G.save.npcCoins[d.np.id] = true; G.save.coins++; play('coin'); writeSave(); this.toast = { str: `${d.np.name} gave you a coin!`, t: 2.5 }; }
        this.mode = 'walk';
      }
    }
    if (menu.back) this.mode = 'walk';
  }

  // ---------- Equip ----------
  openEquip() {
    this.mode = 'equip'; this.eqP = 0; play('menu_select');
    this.buildEquip();
  }
  buildEquip() {
    const s = G.save;
    const cyc = (list, cur, d) => list[(list.indexOf(cur) + d + list.length) % list.length];
    const L = () => s.loadout[this.eqP];
    const ownedW = WEAPON_ORDER.filter((w) => s.weapons.includes(w));
    const items = [];
    if (G.coop) items.push({ label: () => `Player: ${this.eqP ? 'Pint (P2)' : 'Shotty (P1)'}`, left: () => (this.eqP = 1 - this.eqP), right: () => (this.eqP = 1 - this.eqP), action: () => (this.eqP = 1 - this.eqP) });
    for (const slot of [0, 1]) items.push({
      label: () => `Shot ${slot ? 'B' : 'A'}: ${L().weapons[slot] ? WEAPONS[L().weapons[slot]].name : '—'}`,
      left: () => this.setW(slot, cyc(ownedW, L().weapons[slot], -1)), right: () => this.setW(slot, cyc(ownedW, L().weapons[slot], 1)), action: () => this.setW(slot, cyc(ownedW, L().weapons[slot], 1)),
      info: () => { const w = WEAPONS[L().weapons[slot]]; return w ? `${w.desc}  EX: ${w.ex}.` : ''; },
    });
    items.push({ label: () => `Super: ${SUPERS[L().super].name}`, left: () => (L().super = cyc(s.supers, L().super, -1)), right: () => (L().super = cyc(s.supers, L().super, 1)), action: () => (L().super = cyc(s.supers, L().super, 1)), info: () => SUPERS[L().super].desc + `  (${3 - s.supers.length} more to unlock)` });
    items.push({ label: () => `Trinket: ${TRINKETS[L().trinket].name}`, left: () => (L().trinket = cyc(s.trinkets, L().trinket, -1)), right: () => (L().trinket = cyc(s.trinkets, L().trinket, 1)), action: () => (L().trinket = cyc(s.trinkets, L().trinket, 1)), info: () => TRINKETS[L().trinket].desc });
    items.push({ label: 'Done', action: () => this.closeEquip() });
    this.eqMenu = new Menu(items, { back: () => this.closeEquip() });
  }
  setW(slot, w) {
    const L = G.save.loadout[this.eqP];
    const other = L.weapons[1 - slot];
    if (w === other) L.weapons[1 - slot] = L.weapons[slot]; // swap
    L.weapons[slot] = w;
  }
  closeEquip() {
    writeSave(); this.mode = 'walk';
    this.tokens.forEach((p) => { p.weapons = G.save.loadout[p.idx].weapons.slice(); });
  }
  updateEquip() { this.eqMenu.update(); }

  openPause() {
    this.mode = 'pause'; play('menu_select');
    this.pauseMenu = new Menu([
      { label: 'Resume', action: () => (this.mode = 'walk') },
      { label: 'Equipment', action: () => this.openEquip() },
      { label: () => `Players: ${G.coop ? '2 (co-op)' : '1'}`, action: () => { G.coop = !G.coop; writeSave(); G.setScene(new MapScene()); } },
      { label: 'Quit to Title', action: () => { writeSave(); iris.close(() => nav.title()); } },
    ], { back: () => (this.mode = 'walk') });
  }

  // ---------- Drawing ----------
  draw(ctx) {
    const cx = Math.round(this.cam.x), cy = Math.round(this.cam.y);
    // Sea
    ctx.fillStyle = '#3f7f8f'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(-cx, -cy);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
    for (let y = 40; y < MH; y += 90) for (let x = ((y / 90) % 2) * 120; x < MW; x += 240) {
      const o = Math.sin(this.t * 1.5 + x * 0.01 + y) * 8;
      ctx.beginPath(); ctx.moveTo(x + o, y); ctx.quadraticCurveTo(x + 15 + o, y - 10, x + 30 + o, y); ctx.quadraticCurveTo(x + 45 + o, y + 10, x + 60 + o, y); ctx.stroke();
    }
    // Islands
    for (const isl of ISLANDS) this.drawIsland(ctx, isl);
    // Bridges
    for (const b of BRIDGES) this.drawBridge(ctx, b, b.need(G.save));
    // Paths between nodes
    ctx.setLineDash([8, 12]); ctx.strokeStyle = 'rgba(90,60,30,.55)'; ctx.lineWidth = 6;
    const path = [[330, 1080], [380, 900], [560, 860], [330, 700], [660, 640], [850, 1020], [580, 1170], [330, 1080]];
    ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 40) : ctx.moveTo(x, y + 40))); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1160, 860); ctx.lineTo(1310, 1020); ctx.lineTo(1500, 660); ctx.lineTo(1680, 970); ctx.lineTo(1800, 790); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1970, 790); ctx.lineTo(2140, 1030); ctx.lineTo(2340, 580); ctx.stroke();
    ctx.setLineDash([]);
    // Sailboat bobbing on the sea and sparkles on the water
    const bx = 1150 + Math.sin(this.t * 0.15) * 220, by = 1330;
    ctx.save(); ctx.translate(bx, by + Math.sin(this.t * 2) * 4); ctx.rotate(Math.sin(this.t * 1.5) * 0.05);
    poly(ctx, [[-50, 0], [50, 0], [36, 22], [-36, 22]], '#8a5a2a', 3);
    ctx.fillStyle = INK; ctx.fillRect(-2, -80, 4, 80);
    poly(ctx, [[2, -78], [46, -10], [2, -10]], '#f3e6c4', 3);
    poly(ctx, [[-2, -60], [-34, -10], [-2, -10]], '#d63a2a', 3);
    ctx.restore();
    for (let i = 0; i < 14; i++) { const k = (this.t * 0.6 + i * 0.37) % 1; if (k < 0.3) { const sx = (i * 397) % MW, sy = (i * 211) % MH; if (!onIsland(sx, sy)) { ctx.globalAlpha = Math.sin(k / 0.3 * Math.PI); starburst(ctx, sx, sy, 8, 4, '#fff', 0, 0); ctx.globalAlpha = 1; } } }
    // Hidden coins
    for (const c of HIDDEN) if (!G.save.coinsFound['map:' + c.id]) drawCoin(ctx, c.x, c.y + Math.sin(this.t * 4) * 4, this.t);
    // Y-sorted things
    const things = [];
    for (const nd of NODES) things.push({ y: nd.y + 40, d: () => this.drawNode(ctx, nd) });
    for (const np of NPCS) things.push({ y: np.y, d: () => drawNpc(ctx, np, this.t) });
    for (const p of this.tokens) things.push({ y: p.y, d: () => { ctx.save(); ctx.translate(p.x, p.y); ctx.scale(0.72, 0.72); ctx.translate(-p.x, -p.y); p.draw(ctx); ctx.restore(); } });
    things.sort((a, b) => a.y - b.y).forEach((t) => t.d());
    // Drifting cloud shadows
    ctx.save(); ctx.fillStyle = 'rgba(20,30,40,.10)';
    for (let i = 0; i < 5; i++) { const x = ((this.t * 18 + i * 640) % (MW + 600)) - 300, y = 200 + i * 290; ctx.beginPath(); ctx.ellipse(x, y, 220, 90, 0, 0, 7); ctx.ellipse(x + 160, y + 30, 150, 70, 0, 0, 7); ctx.fill(); }
    ctx.restore();
    // Prompt bubble
    if (this.near && this.mode === 'walk') {
      const p = this.tokens[0];
      const label = this.near.type === 'node' ? this.near.nd.label : this.near.type === 'npc' ? `Talk to ${this.near.np.name}` : 'Locked bridge';
      const x = this.near.type === 'node' ? this.near.nd.x : p.x, y = this.near.type === 'node' ? this.near.nd.y - 110 : p.y - 110;
      ctx.font = `22px ${FONT_UI}`;
      const w = ctx.measureText(label).width + 40;
      roundRect(ctx, x - w / 2, y - 22, w, 44, 10, '#f3e6c4', 3);
      text(ctx, label, x, y, 22, INK, 'center', FONT_UI, 0);
    }
    ctx.restore();

    // HUD
    roundRect(ctx, 20, 20, 250, 54, 10, '#f3e6c4', 3);
    drawCoin(ctx, 48, 47, this.t);
    text(ctx, `${G.save.coins}`, 76, 48, 26, INK, 'left', FONT_UI, 0);
    text(ctx, `IOUs ${iouCount()}/5`, 255, 48, 24, '#7a1c1c', 'right', FONT_UI, 0);
    text(ctx, 'JUMP: enter · EX: equipment · Esc: menu', W - 20, 40, 18, '#fff', 'right', FONT_UI, 4);
    if (this.toast) {
      ctx.font = `24px ${FONT_UI}`; const w = ctx.measureText(this.toast.str).width + 50;
      roundRect(ctx, W / 2 - w / 2, H - 100, w, 52, 10, '#f3e6c4', 4);
      text(ctx, this.toast.str, W / 2, H - 74, 24, INK, 'center', FONT_UI, 0);
    }
    if (this.mode === 'card') this.drawCard(ctx);
    if (this.mode === 'talk') this.drawTalk(ctx);
    if (this.mode === 'equip') this.drawEquip(ctx);
    if (this.mode === 'pause') {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H);
      panel(ctx, W / 2 - 230, 180, 460, 340);
      text(ctx, 'Menu', W / 2, 230, 42, '#c0392b', 'center', FONT_TITLE, 0);
      this.pauseMenu.draw(ctx, W / 2, 300, 30, 52);
    }
  }

  drawCard(ctx) {
    const nd = this.card, def = LEVELS[nd.id];
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.02);
    panel(ctx, -330, -250, 660, 500);
    text(ctx, def.name, 0, -185, 46, '#c0392b', 'center', FONT_TITLE, 0);
    text(ctx, def.subtitle || nd.label, 0, -135, 24, INK, 'center', FONT_UI, 0);
    const b = G.save.beaten[nd.id];
    text(ctx, b ? `Best grade: ${b.grade} (${DIFFS[b.diff]})` : 'Not yet beaten', 0, -95, 22, '#2f5e2c', 'center', FONT_UI, 0);
    if (G.save.iou[nd.id]) text(ctx, 'IOU collected ✓', 0, -65, 20, '#7a1c1c', 'center', FONT_UI, 0);
    ctx.restore();
    this.cardMenu.draw(ctx, W / 2, H / 2 - 10, 32, 50);
  }

  drawTalk(ctx) {
    const { np, i } = this.dialog;
    panel(ctx, 160, H - 230, W - 320, 190);
    text(ctx, np.name, 200, H - 195, 28, '#c0392b', 'left', FONT_TITLE, 0);
    wrapText(ctx, np.lines[i], 200, H - 150, W - 400, 26, 34);
    text(ctx, '▼', W - 200, H - 65, 22, INK, 'center', FONT_UI, 0);
  }

  drawEquip(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
    panel(ctx, 200, 90, 880, 540);
    text(ctx, 'Equipment', W / 2, 140, 44, '#c0392b', 'center', FONT_TITLE, 0);
    this.eqMenu.draw(ctx, 300, 220, 30, 58, INK, '#c0392b', 'left');
    const it = this.eqMenu.items[this.eqMenu.i];
    if (it.info) { roundRect(ctx, 260, 520, 760, 80, 10, '#e9d7aa', 2); wrapText(ctx, it.info(), 280, 545, 720, 20, 26); }
    text(ctx, '←/→ to change', 1040, 600, 16, INK, 'right', FONT_UI, 0);
  }

  drawIsland(ctx, isl) {
    const pts = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r = 1 + Math.sin(a * 3 + isl.seed) * 0.05 + Math.sin(a * 7 + isl.seed * 2) * 0.03;
      pts.push([isl.x + Math.cos(a) * isl.rx * r, isl.y + Math.sin(a) * isl.ry * r]);
    }
    const shape = (s, off = 0) => { ctx.beginPath(); pts.forEach(([x, y], i) => { const px = isl.x + (x - isl.x) * s, py = isl.y + (y - isl.y) * s + off; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); };
    shape(1.08, 14); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill();
    shape(1.0, 16); ctx.fillStyle = '#7a5a30'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
    shape(1.0); ctx.fillStyle = '#e8d29a'; ctx.fill(); ctx.stroke();
    shape(0.9); ctx.fillStyle = '#8dbb5a'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    // Trees
    for (let i = 0; i < 10; i++) {
      const a = isl.seed * 3 + i * 2.39, rr = 0.55 + ((i * 37) % 10) / 30;
      const tx = isl.x + Math.cos(a) * isl.rx * rr * 0.9, ty = isl.y + Math.sin(a) * isl.ry * rr * 0.85;
      if (NODES.some((n) => Math.hypot(n.x - tx, n.y - ty) < 120)) continue;
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(tx, ty + 6, 22, 7, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b4220'; ctx.fillRect(tx - 4, ty - 20, 8, 24);
      circle(ctx, tx, ty - 34, 22, '#4f8a3a', 3); circle(ctx, tx - 14, ty - 24, 14, '#4f8a3a', 3); circle(ctx, tx + 14, ty - 24, 14, '#4f8a3a', 3);
    }
  }

  drawBridge(ctx, b, open) {
    if (!open) {
      ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      ctx.rotate(-0.9);
      roundRect(ctx, -b.w / 2, -b.h / 2, b.w, b.h, 4, '#9a6a3a', 3);
      ctx.restore();
      roundRect(ctx, b.x - 30, b.y - 50, 20, 100, 4, '#6b4220', 3);
      return;
    }
    roundRect(ctx, b.x - 20, b.y, b.w + 40, b.h, 4, '#9a6a3a', 4);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let x = b.x; x < b.x + b.w; x += 18) { ctx.beginPath(); ctx.moveTo(x, b.y); ctx.lineTo(x, b.y + b.h); ctx.stroke(); }
  }

  drawNode(ctx, nd) {
    const s = G.save;
    const locked = nd.need && !nd.need(s);
    ctx.save(); ctx.translate(nd.x, nd.y);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 40, 90, 20, 0, 0, 7); ctx.fill();
    const t = this.t;
    switch (nd.kind) {
      case 'saloon':
        roundRect(ctx, -90, -70, 180, 110, 4, '#a0602c', 4);
        poly(ctx, [[-100, -70], [100, -70], [80, -110], [-80, -110]], '#6b3a1a', 4);
        roundRect(ctx, -70, -150, 140, 44, 6, '#2e1a0c', 4);
        text(ctx, 'LAST CALL', 0, -128, 22, locked ? '#888' : '#ffd86a', 'center', FONT_TITLE, 0);
        roundRect(ctx, -26, -20, 52, 60, 3, '#2e1a0c', 3);
        roundRect(ctx, -24, -10, 22, 34, 2, '#d9a93a', 2); roundRect(ctx, 2, -10, 22, 34, 2, '#d9a93a', 2);
        for (const x of [-60, 60]) roundRect(ctx, x - 16, -50, 32, 28, 3, '#ffe39a', 3);
        if (locked) { circle(ctx, 0, -190, 22, '#888', 3); text(ctx, '🔒', 0, -190, 22, INK, 'center', FONT_UI, 0); }
        break;
      case 'brewery':
        roundRect(ctx, -80, -60, 160, 100, 4, '#b5523a', 4);
        ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; for (let y = -50; y < 40; y += 16) { ctx.beginPath(); ctx.moveTo(-80, y); ctx.lineTo(80, y); ctx.stroke(); }
        poly(ctx, [[-90, -60], [90, -60], [0, -110]], '#6b3a1a', 4);
        ellipse(ctx, 40, -120, 30, 34, '#9b5a2a', 4);
        for (let i = 0; i < 3; i++) circle(ctx, 30 + i * 12, -160 - Math.sin(t * 3 + i) * 4, 10, '#fffbea', 2.5);
        roundRect(ctx, -22, -10, 44, 50, 20, '#2e1a0c', 3);
        break;
      case 'opera':
        roundRect(ctx, -90, -50, 180, 90, 4, '#e8dcc0', 4);
        for (let x = -70; x <= 70; x += 35) roundRect(ctx, x - 7, -46, 14, 82, 3, '#fff', 2.5);
        poly(ctx, [[-100, -50], [100, -50], [0, -90]], '#c9a03a', 4);
        ctx.beginPath(); ctx.arc(0, -90, 50, Math.PI, 0); ctx.fillStyle = '#7a0c1a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = INK; ctx.fillRect(-2, -175, 4, 40);
        poly(ctx, [[2, -175], [40 + Math.sin(t * 5) * 4, -165], [2, -155]], PINK, 3);
        break;
      case 'street':
        for (let i = 0; i < 3; i++) { const x = -80 + i * 60; roundRect(ctx, x - 26, -50 - i * 10, 52, 90 + i * 10, 3, ['#7a5a8a', '#5a7a8a', '#8a6a4a'][i], 3); roundRect(ctx, x - 12, -30 - i * 10, 24, 22, 2, '#ffe39a', 2); }
        ctx.fillStyle = INK; ctx.fillRect(84, -80, 6, 120); circle(ctx, 87, -86, 12, '#ffe680', 3);
        break;
      case 'practice':
        roundRect(ctx, -60, -40, 120, 80, 4, '#a07040', 4);
        poly(ctx, [[-72, -40], [72, -40], [0, -88]], '#5a3218', 4);
        roundRect(ctx, -16, -6, 32, 46, 3, '#2e1a0c', 3);
        roundRect(ctx, -70, -128, 140, 32, 6, '#f3e6c4', 3);
        text(ctx, 'PRACTICE', 0, -112, 18, '#7a1c1c', 'center', FONT_TITLE, 0);
        if (!s.tutorialDone) text(ctx, '!', 70, -150 + Math.sin(t * 5) * 5, 36, '#ffd84a', 'center', FONT_TITLE, 5);
        break;
      case 'shop':
        roundRect(ctx, -70, -50, 140, 90, 4, '#7a5a30', 4);
        poly(ctx, [[-80, -50], [80, -50], [60, -90], [-60, -90]], '#3b6b2c', 4);
        roundRect(ctx, -60, -120, 120, 34, 6, '#f3e6c4', 3);
        text(ctx, "BARLEY'S", 0, -103, 20, '#7a1c1c', 'center', FONT_TITLE, 0);
        roundRect(ctx, -20, -10, 40, 50, 3, '#2e1a0c', 3);
        circle(ctx, 50, -20, 10, Math.floor(t * 2) % 2 ? '#ffe680' : '#ffb347', 3);
        break;
      case 'arena':
        ellipse(ctx, 0, 0, 100, 50, '#c9a06a', 4);
        ellipse(ctx, 0, -6, 76, 34, '#e8d29a', 3);
        for (const x of [-70, 70]) { roundRect(ctx, x - 6, -70, 12, 70, 3, '#ddd', 2); }
        ctx.strokeStyle = '#d63a2a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-70, -60); ctx.lineTo(70, -60); ctx.moveTo(-70, -40); ctx.lineTo(70, -40); ctx.stroke();
        drawCactus(ctx, -120, 20); drawCactus(ctx, 120, 10);
        break;
      case 'vineyard':
        for (let r = 0; r < 3; r++) { ctx.strokeStyle = '#6b4220'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-90, -30 + r * 30); ctx.lineTo(90, -30 + r * 30); ctx.stroke(); for (let x = -80; x <= 80; x += 32) circle(ctx, x, -36 + r * 30, 10, '#7b2d8e', 2); }
        ctx.fillStyle = '#6b4220'; ctx.fillRect(60, -130, 12, 90);
        ctx.save(); ctx.translate(66, -130); ctx.rotate(t * 1.5);
        for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); roundRect(ctx, 0, -6, 50, 12, 2, '#f3e6c4', 2.5); }
        ctx.restore();
        break;
      case 'tavern':
        roundRect(ctx, -80, -60, 160, 100, 4, '#8a5a3a', 4);
        poly(ctx, [[-90, -60], [90, -60], [0, -105]], '#4a2e17', 4);
        roundRect(ctx, -60, -40, 40, 30, 2, '#ffe39a', 3);
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-58, -38); ctx.lineTo(-40, -22); ctx.lineTo(-30, -36); ctx.stroke();
        roundRect(ctx, 0, -20, 40, 60, 3, '#2e1a0c', 3);
        if (Math.sin(t * 6) > 0.6) starburst(ctx, 60, -80, 20, 7, '#ffe14a', t, 2);
        break;
      case 'airfield':
        ctx.fillStyle = '#9a9a8a'; ctx.fillRect(-110, 10, 220, 30); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(-110, 10, 220, 30);
        ctx.setLineDash([12, 10]); ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-100, 25); ctx.lineTo(100, 25); ctx.stroke(); ctx.setLineDash([]);
        drawMiniPlane(ctx, 0, -30 + Math.sin(t * 2) * 3);
        ctx.fillStyle = INK; ctx.fillRect(-100, -80, 4, 90);
        poly(ctx, [[-96, -80], [-60 + Math.sin(t * 6) * 4, -74], [-96, -64]], '#ff8a1e', 2.5);
        break;
      case 'lounge':
        roundRect(ctx, -80, -80, 160, 120, 4, '#2a2a3a', 4);
        for (let x = -60; x <= 60; x += 30) ctx.fillStyle = '#c9a03a', ctx.fillRect(x - 2, -80, 4, 120);
        roundRect(ctx, -22, -10, 44, 50, 3, '#c9a03a', 3);
        ctx.save(); ctx.translate(0, -120);
        const glow = Math.floor(t * 3) % 4 ? '#ff7ad9' : '#ffb3ec';
        ctx.strokeStyle = glow; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-30, -30); ctx.lineTo(30, -30); ctx.lineTo(0, 5); ctx.closePath(); ctx.moveTo(0, 5); ctx.lineTo(0, 30); ctx.moveTo(-15, 30); ctx.lineTo(15, 30); ctx.stroke();
        circle(ctx, 12, -22, 6, '#8dd14f', 2);
        ctx.restore();
        break;
    }
    ctx.restore();
    // Flag for beaten levels
    const b = s.beaten[nd.id];
    if (b) {
      ctx.fillStyle = INK; ctx.fillRect(nd.x + 95, nd.y - 60, 4, 100);
      poly(ctx, [[nd.x + 99, nd.y - 60], [nd.x + 150 + Math.sin(this.t * 5) * 4, nd.y - 46], [nd.x + 99, nd.y - 30]], '#ffe39a', 3);
      text(ctx, b.grade, nd.x + 120, nd.y - 45, 16, '#c0392b', 'center', FONT_TITLE, 0);
    }
  }
}

export function drawCoin(ctx, x, y, t) {
  const sx = Math.abs(Math.cos(t * 3));
  ctx.save(); ctx.translate(x, y); ctx.scale(0.3 + sx * 0.7, 1);
  circle(ctx, 0, 0, 14, '#ffd84a', 3);
  circle(ctx, 0, 0, 8, '#ffec9a', 2);
  ctx.restore();
}
function drawCactus(ctx, x, y) {
  roundRect(ctx, x - 9, y - 60, 18, 60, 9, '#5a9a3a', 3);
  roundRect(ctx, x - 26, y - 44, 12, 26, 6, '#5a9a3a', 3);
  roundRect(ctx, x + 14, y - 50, 12, 26, 6, '#5a9a3a', 3);
}
export function drawMiniPlane(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  roundRect(ctx, -50, -10, 90, 24, 12, '#d63a2a', 3);
  roundRect(ctx, -20, -26, 30, 56, 6, '#f3e6c4', 3);
  circle(ctx, 44, 2, 6, '#888', 2);
  ctx.restore();
}
function drawNpc(ctx, np, t) {
  ctx.save(); ctx.translate(np.x, np.y);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 6, 0, 0, 7); ctx.fill();
  const bob = Math.sin(t * 3 + np.x) * 2;
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-6, -14); ctx.lineTo(-8, 0); ctx.moveTo(6, -14); ctx.lineTo(8, 0); ctx.stroke();
  if (np.look === 'bottle') { roundRect(ctx, -16, -70 + bob, 32, 58, 10, np.color, 3); roundRect(ctx, -7, -92 + bob, 14, 24, 4, np.color, 3); ctx.fillStyle = '#f3e6c4'; ctx.fillRect(-12, -52 + bob, 24, 18); }
  else if (np.look === 'lemon') { ellipse(ctx, 0, -40 + bob, 24, 28, np.color, 3); circle(ctx, 0, -70 + bob, 5, '#8dbb5a', 2); }
  else if (np.look === 'water') { poly(ctx, [[-20, -76 + bob], [20, -76 + bob], [15, -12], [-15, -12]], 'rgba(220,240,255,.95)', 3); ctx.fillStyle = np.color; ctx.fillRect(-15, -60 + bob, 30, 44); }
  else { roundRect(ctx, -20, -64 + bob, 40, 52, 6, 'rgba(220,240,255,.95)', 3); ctx.fillStyle = np.color; ctx.fillRect(-17, -46 + bob, 34, 31); roundRect(ctx, -10, -50 + bob, 14, 14, 3, '#e0f4ff', 2); }
  pieEye(ctx, -6, -46 + bob, 4, 6, 0); pieEye(ctx, 6, -46 + bob, 4, 6, 0);
  mouth(ctx, 0, -34 + bob, 5, 0.2);
  ctx.restore();
  if (np.coin && !G.save.npcCoins[np.id]) text(ctx, '!', np.x, np.y - 110 + Math.sin(t * 5) * 4, 30, '#ffd84a', 'center', FONT_TITLE, 5);
}
export function wrapText(ctx, str, x, y, maxW, size, lh) {
  ctx.font = `${size}px ${FONT_UI}`;
  const words = str.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { text(ctx, line, x, yy, size, INK, 'left', FONT_UI, 0); line = w; yy += lh; }
    else line = test;
  }
  if (line) text(ctx, line, x, yy, size, INK, 'left', FONT_UI, 0);
}
