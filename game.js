'use strict';
const TIME_SCALE = 1; // in-game seconds per real second
const HOUR = 3600000 / TIME_SCALE, MIN = 60000 / TIME_SCALE;
const OT = 60 / TIME_SCALE; // real ms per original ms (60 at full scale)
const DEBUG = true; // debug overlay always on while developing. Set to false for the final version
const HOVER_MS = 100; // how long the mouse rests on a screen edge before you turn
const MOVE_MS = 1000; // animations speed
const FOXY_DECAY = 1000; // ms of holding the closet door per Foxy stage removed
// AI levels per in-game hour (12 AM to 5 AM).
const ramp = (b, d) => [b, b, b, b + d, b + d, b + d]; // base, plus d from 3 AM
const flat = v => [v, v, v, v, v, v];
const cut = v => [v, v, v, v, 0, 0]; // everyone but the boss drops to 0 at 4 AM
const Z = flat(0);
const NIGHTS = [
  {freddy: [0,0,1,2,2,2], bonnie: [0,0,1,3,3,3], chica: [0,0,1,2,2,2], foxy: Z, boss: Z},
  {freddy: ramp(2,1), bonnie: ramp(5,2), chica: ramp(5,2), foxy: ramp(1,3), boss: Z},
  {freddy: flat(3), bonnie: ramp(7,3), chica: ramp(7,3), foxy: flat(10), boss: Z},
  {freddy: flat(4), bonnie: ramp(10,2), chica: ramp(10,2), foxy: ramp(5,5), boss: Z},
  {freddy: Z, bonnie: Z, chica: Z, foxy: Z, boss: flat(12)},
  {freddy: cut(5), bonnie: cut(12), chica: cut(12), foxy: cut(10), boss: [0,0,0,0,15,15]},
  {freddy: cut(6), bonnie: cut(15), chica: cut(15), foxy: cut(15), boss: [0,0,0,0,20,20]},
  {freddy: cut(6), bonnie: cut(20), chica: cut(20), foxy: cut(20), boss: [0,0,0,0,20,20]}];
let NIGHT = 1;
const L = (n, h) => G && G.mods && G.mods.nm ? (n === 'boss' ? 20 : 0) : NIGHTS[NIGHT - 1][n][h]; // All Nightmare: only Nightmare, level 20
const BN = () => (G && G.mods.nm ? 8 : NIGHT) >= 7 ? 'Nightmare' : 'Fredbear';
const FS = f => !f.on ? 0 : f.v >= 6 ? 4 : f.v >= 4 ? 3 : f.v >= 2 ? 2 : 1; // visible Foxy stage from his 0-10 variable
const COL = {bonnie:'#7a5bb5', chica:'#e0a93b', foxy:'#b5452f', boss:'#2b2410', freddy:'#8a6440'};
const SIDE = {LEFT: {pan: -1, hall: 'LHALL', side: 'LSIDE'}, RIGHT: {pan: 1, hall: 'RHALL', side: 'RSIDE'}};
const OPP = {LEFT: 'RIGHT', RIGHT: 'LEFT'};
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const roll = lvl => Math.floor(Math.random() * 20) + 1 <= lvl;

const AM = {
  ctx: null,
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C(); this.ctx.resume();
    const r = this.ctx.sampleRate, b = this.ctx.createBuffer(1, r * 2, r), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.buf = b;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = b; s.loop = true; f.type = 'lowpass'; f.frequency.value = 160; g.gain.value = 0.05;
    s.connect(f); f.connect(g); g.connect(this.ctx.destination); s.start();
  },
  route(pan) { const p = this.ctx.createStereoPanner(); p.pan.value = pan; p.connect(this.ctx.destination); return p; },
  tone(pan, hz, len, vol, type = 'sine') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = hz;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    o.connect(g); g.connect(this.route(pan)); o.start(t); o.stop(t + len);
  },
  hiss(pan, len, vol, cut) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.buf; f.type = 'lowpass'; f.frequency.value = cut;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    s.connect(f); f.connect(g); g.connect(this.route(pan)); s.start(t); s.stop(t + len);
  },
  step(pan, v = 0.25) { this.tone(pan, 60, 0.12, v); setTimeout(() => this.tone(pan, 52, 0.12, v * 0.8), 300); },
  clang(pan) { this.tone(pan, 900, 0.1, 0.15, 'square'); setTimeout(() => this.tone(pan, 700, 0.1, 0.12, 'square'), 120); },
  laugh() { [300, 250, 300, 250].forEach((f, i) => setTimeout(() => this.tone(0, f, 0.15, 0.12, 'square'), i * 180)); },
  screech(v) { this.hiss(0, 0.5, v, 3500); },
  breathe(pan) { this.hiss(pan, 1.8, 0.12, 600); },
  scare() { [110, 165, 220, 331].forEach(f => this.tone(0, f, 1.2, 0.35, 'sawtooth')); this.hiss(0, 1.2, 0.6, 8000); }
};

let G = null, timer = null, wl = null, flick = 0;
async function lock() { try { if ('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
const bot = (min, max, extra) => Object.assign({min, max, at: 0, dl: 0, full: 0, blk: 0, t: 0, v: 0, on: false, ps: 0, since: 0, fl: 0, fk: 0, lt: 0, laughs: 0, sec: 0, num: 0, c: [0, 0], left: false, p: 0, cleared: false, noClear: false, doom: false, forced: false, force: 99}, extra);
const schedule = a => { a.at = performance.now() + rnd(a.min, a.max) * MIN; };

function show(id) { document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id)); if (id === 'nights') updStars(); }

function newGame(n, skip = 0, mods) {
  NIGHT = n; const m = mods || {blind: false, foxy: false, mad: false, nm: false};
  const now = performance.now();
  G = {start: now, view: 'CENTER', flash: false, running: true, hid: 0, freddles: 0, run: now, bedAt: 0, last: now, hs: 0, mods: m, sc: 0,
    doors: {LEFT: false, RIGHT: false, CLOSET: false},
    bots: {
      bonnie: bot(5, 5, {side: 'LEFT', pan: -1, loc: 0, force: NIGHT >= 2 && NIGHT <= 4 ? 2 + Math.floor(Math.random() * 4) : 99}),
      chica: bot(5, 5, {side: 'RIGHT', pan: 1, loc: 0, force: NIGHT >= 2 && NIGHT <= 4 ? 3 + Math.floor(Math.random() * 3) : 99}),
      foxy: bot(5, 5, {loc: 'CENTER'}), freddy: bot(m.mad ? 2 : 4, m.mad ? 2 : 4), boss: bot(0, 0, {loc: 'CENTER', side: 'LEFT'})}};
  Object.values(G.bots).forEach(schedule);
  G.bots.boss.at = now + 20000; // Fredbear/Nightmare do not move for the first 20 s
  G.start = now - skip * HOUR; // Plushtrap reward: skip hours
  if (m.foxy) foxyEnter(now); // Insta-Foxy
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 100);
  if (flick) clearInterval(flick);
  flick = setInterval(() => { if (G && G.running && G.flash && danger() >= 2) render(); }, 90); // flashlight flicker
  $('dbg').classList.toggle('on', DEBUG); $('mm').classList.toggle('on', DEBUG);
  show('game'); render();
}

const getStars = () => { try { return JSON.parse(localStorage.getItem('fnaf4stars') || '[]'); } catch (e) { return []; } };
function updStars() { $('stars').textContent = 'Stars: ' + getStars().length + ' of 10'; }
function award() { // stars 1-4: beat nights 5-8. Stars 5-10: beat Night 7 with challenge combos
  const m = G.mods, on = Object.keys(m).filter(k => m[k]).sort().join('+');
  const s = !on ? (NIGHT >= 5 ? NIGHT - 4 : 0) : NIGHT === 7 ? ({blind: 5, mad: 6, foxy: 7, 'blind+foxy+mad': 8, nm: 9, 'blind+nm': 10}[on] || 0) : 0;
  if (s) { const a = getStars(); if (!a.includes(s)) { a.push(s); try { localStorage.setItem('fnaf4stars', JSON.stringify(a)); } catch (e) {} } }
  return s;
}

function end(win, why, who) {
  G.running = false; clearInterval(timer); clearInterval(flick);
  if (wl) { wl.release().catch(() => {}); wl = null; }
  if (win) {
    const mods = Object.values(G.mods).some(Boolean);
    const st = award(); $('wp').textContent = 'Night ' + NIGHT + ' complete.' + (st ? ' Star ' + st + ' earned.' : ''); $('nx').hidden = NIGHT >= 8;
    $('nx').textContent = !mods && NIGHT <= 7 ? 'Fun with ' + (MINI === 'nbb' ? 'Balloon Boy' : 'Plushtrap') : 'Next night';
    return show('win');
  }
  $('why').textContent = why; AM.scare();
  if (!who) return show('over');
  const x = $('cv').getContext('2d'), frames = {foxy: 25, freddy: 31}[who] || 40; let i = 0; // jumpscare lengths in frames at 60 fps
  const iv = setInterval(() => {
    const s = 1.5 + i * 0.12;
    x.globalAlpha = 1; x.fillStyle = '#000'; x.fillRect(0, 0, 960, 540);
    fig(x, 480 + (i % 2 ? 6 : -6), 270 + 66 * s, s, COL[who], 1);
    if (++i >= frames) { clearInterval(iv); show('over'); }
  }, 1000 / 60);
}

// boundaries of a repeating real-time interval crossed since a timestamp (for 'cleared at the next N-second tick')
const cross = (since, iv, now) => Math.floor((now - G.start) / iv) - Math.floor((since - G.start) / iv);

function check() {
  const g = G, b = g.bots, y = b.freddy, now = performance.now(), h = Math.min(5, Math.floor((now - g.start) / HOUR));
  for (const n of ['bonnie', 'chica'])
    if (g.flash && g.view === b[n].side && b[n].loc === 3) return end(false, 'The flashlight gave you away.', n);
  if (y.p >= 80) return end(false, 'The Freddles overwhelmed you.', 'freddy');
  if (y.p >= 60 && g.view === 'BED' && (g.flash || (g.bedAt && now - g.bedAt >= 3000))) return end(false, 'The Freddles got you.', 'freddy');
  if (L('boss', h) > 0 && now - g.run >= 25000) return end(false, BN() + ' caught you standing still.', 'boss');
}

function foxyEnter(now) { const f = G.bots.foxy; f.on = true; f.v = 3 + Math.floor(Math.random() * 5); f.loc = 'CLOSET'; f.blk = now; }
function bossSet(now, loc) { const s = G.bots.boss; s.loc = loc; s.since = now; s.fl = 0; }

// Bonnie/Chica movement opportunity. Locations: 0 living room, 1 side of living room, 2 far hall, 3 door
function bcMove(n, lv) {
  const a = G.bots[n], sd = a.side;
  if (G.view === sd || (G.doors[sd] && (a.cleared || a.noClear)) || !roll(lv)) return;
  a.k = false;
  if (a.loc === 0) { a.loc = 1; AM.step(a.pan, 0.1); }
  else if (a.loc === 1) {
    const r = Math.floor(Math.random() * (n === 'chica' ? 3 : 2)); // Bonnie: hall or back. Chica: hall, back or kitchen
    if (r === 0) { a.loc = 2; AM.step(a.pan, 0.25); }
    else { a.loc = 0; if (r === 2) { AM.clang(a.pan); a.k = true; } AM.step(a.pan, 0.1); }
  } else if (a.loc === 2) { a.loc = 3; a.t = 0; AM.step(a.pan, 0.25); }
}

function bossMove(now) {
  const s = G.bots.boss;
  if (s.loc === 'CENTER') { s.side = Math.random() < 0.5 ? 'LEFT' : 'RIGHT'; bossSet(now, SIDE[s.side].side); AM.step(SIDE[s.side].pan, 0.1); }
  else if (s.loc === 'LSIDE' || s.loc === 'RSIDE') {
    s.side = s.loc === 'LSIDE' ? 'LEFT' : 'RIGHT';
    if (Math.random() < 0.5) bossSet(now, SIDE[s.side].hall); // silent
    else { s.side = OPP[s.side]; bossSet(now, SIDE[s.side].side); AM.step(SIDE[s.side].pan, 0.15); }
  }
}

function tick() {
  if (!G || !G.running || document.hidden) return;
  const now = performance.now(), el = now - G.start, dt = now - G.last; G.last = now;
  if (el >= 6 * HOUR) return end(true);
  if (G.view === 'MOVE' && now >= G.mvAt + MOVE_MS) { arrive(); if (!G.running) return; }
  const h = Math.floor(el / HOUR), b = G.bots, f = b.foxy, y = b.freddy, s = b.boss;
  // Bonnie and Chica
  for (const n of ['bonnie', 'chica']) {
    const a = b[n], lv = L(n, h), sd = a.side;
    if (!G.doors[sd]) { a.cleared = false; a.noClear = false; }
    if (G.flash && G.view === sd && a.loc === 2) { a.loc = 0; a.t = 0; a.left = false; AM.step(a.pan, 0.1); }
    if (a.force <= h && !a.forced && G.view === 'CENTER' && a.loc < 3) { a.forced = true; a.loc = 3; a.t = 0; AM.step(a.pan, 0.25); }
    if (now >= a.at) { schedule(a); bcMove(n, lv); }
    if (a.loc === 3) {
      a.t += dt / 1000;
      if (G.held === 'door' && G.dv === sd && !a.noClear && cross(G.hs, 3000, now) >= 1) { a.loc = 1; a.t = 0; a.left = false; a.cleared = true; a.doom = false; AM.step(a.pan, 0.25); }
      else if (!a.left && a.t >= 10) { // after 10s at the door they go back to the hall, once per attack
        a.left = true;
        if (G.held === 'door' && G.dv === sd && now - G.hs < 167) a.noClear = true; // door still closing (10 frames): not counted as listening, so she cannot be cleared
        else { a.loc = 2; AM.step(a.pan, 0.25); }
      }
      if (a.loc === 3 && a.t >= 20 - NIGHT + (n === 'bonnie' ? 1 : 0)) a.doom = true; // kills when you next view the bed
    }
  }
  // Foxy
  if (f.on && G.held === 'door' && G.dv === 'CLOSET' && f.v > 0 && now - f.blk >= FOXY_DECAY) { f.v--; f.blk = now; }
  if (G.flash && ((f.loc === 'LHALL' && G.view === 'LEFT') || (f.loc === 'RHALL' && G.view === 'RIGHT'))) f.loc = 'CENTER';
  if (now >= f.at) {
    schedule(f);
    if (roll(L('foxy', h))) { // same 1-20 roll as the others
      if (f.on) { if (f.v < 10) f.v++; }
      else if (f.loc === 'CENTER') { f.loc = Math.random() < 0.5 ? 'LSIDE' : 'RSIDE'; AM.step(f.loc === 'LSIDE' ? -1 : 1, 0.1); }
      else if (f.loc === 'LSIDE' || f.loc === 'RSIDE') {
        const isL = f.loc === 'LSIDE';
        if (Math.random() < 0.9) f.loc = isL ? 'RSIDE' : 'LSIDE';
        else if (G.view !== (isL ? 'LEFT' : 'RIGHT')) f.loc = isL ? 'LHALL' : 'RHALL';
        AM.step(isL ? -1 : 1, 0.1);
      }
    }
  }
  if (G.view === 'BED' && G.bedAt && now - G.bedAt >= 15000) return end(false, 'You stared at the bed too long.', 'foxy');
  const fs = FS(f); if (fs > f.ps) AM.step(0, 0.15); f.ps = fs;
  // Freddy: progress counter
  if (now >= y.at) { schedule(y); if (!(G.view === 'BED' && G.flash)) y.p += G.mods.mad ? 5 : L('freddy', h); }
  if (NIGHT >= 2 && now - G.run >= 30000) y.p += 5 * dt / 1000;
  if (G.view === 'BED' && G.flash) y.p = Math.max(0, y.p - dt / 50);
  G.freddles = Math.min(3, Math.floor(y.p / 10));
  if (y.p >= 20 && now - G.sc >= 3000) { G.sc = now; AM.screech(y.p >= 30 ? 0.08 : 0.04); } // Freddle screeching, louder with progress
  // Fredbear (nights 5-6) / Nightmare (nights 7-8)
  if (L('boss', h) > 0) {
    const en = G.mods.nm ? 8 : NIGHT, fb = en < 7;
    if (now - s.fk >= 10000) { s.fk = now; if (s.loc !== 'BED' && Math.random() < 0.1) AM.laugh(); } // fake laugh
    const ss = Math.floor(now / 1000);
    if (ss !== s.sec) { s.sec = ss; s.num = Math.random() < 0.5 ? 0 : 1; }
    if (s.loc !== 'BED' && s.loc !== 'CLOSET' && s.laughs < (en === 5 ? 4 : 2)) {
      s.c[s.num] += dt / 1000;
      if (Math.max(s.c[0], s.c[1]) >= (fb ? 30 : 20)) { s.c = [0, 0]; s.laughs++; AM.laugh(); bossSet(now, Math.random() < 0.5 ? 'BED' : 'CLOSET'); }
    }
    if (now >= s.at) { s.at = now + (fb ? 3 : 2) * MIN; if (roll(L('boss', h))) bossMove(now); }
    if (s.loc === 'LHALL' || s.loc === 'RHALL') {
      const sd = s.loc === 'LHALL' ? 'LEFT' : 'RIGHT';
      if (G.flash && G.view === sd) { s.fl = s.fl || now; if (now - s.fl >= (fb ? (en === 5 ? 500 : 417) : 333)) // 30, 25 or 20 frames at 60 fps
        return end(false, BN() + ' got to you.', 'boss'); } else s.fl = 0;
      if (G.held === 'door' && G.dv === sd && cross(G.hs, fb ? 3000 : 2000, now) >= 1) { s.side = OPP[sd]; bossSet(now, SIDE[s.side].side); AM.step(SIDE[s.side].pan, 0.15); }
      else if (now - s.since >= (en <= 6 ? 15 : en === 7 ? 10 : 8) * 1000) return end(false, BN() + ' got to you.', 'boss');
    } else if (s.loc === 'BED' || s.loc === 'CLOSET') {
      if (now - s.since >= (fb ? 20 : 11) * 1000) return end(false, BN() + ' got to you.', 'boss');
      let out = false;
      if (s.loc === 'BED') { if (G.flash && G.view === 'BED') { s.fl = s.fl || now; out = cross(s.fl, 1000, now) >= 2; } else s.fl = 0; }
      else out = G.held === 'door' && G.dv === 'CLOSET' && cross(G.hs, 3000, now) >= 1;
      if (out) { s.side = Math.random() < 0.5 ? 'LEFT' : 'RIGHT'; bossSet(now, SIDE[s.side].side); }
    }
  }
  check(); if (G.running) render();
}

function danger() {
  const b = G.bots, p = b.freddy.p; let d = b.foxy.on ? 2 : 0;
  for (const n of ['bonnie', 'chica']) d += b[n].loc === 2 ? 1 : b[n].loc === 3 ? 2 : 0;
  return d + (p >= 50 ? 5 : p >= 30 ? 3 : p >= 20 ? 1 : 0);
}

function fig(x, cx, by, s, col, a) {
  x.globalAlpha = a; x.fillStyle = col;
  x.fillRect(cx - 25 * s, by - 110 * s, 50 * s, 110 * s);
  x.beginPath(); x.arc(cx, by - 128 * s, 24 * s, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.fillRect(cx - 14 * s, by - 134 * s, 8 * s, 8 * s); x.fillRect(cx + 6 * s, by - 134 * s, 8 * s, 8 * s);
  x.globalAlpha = 1;
}

function draw() {
  const x = $('cv').getContext('2d'), g = G, v = g.view, b = g.bots, dg = danger(), dm = g.flash && Math.random() < (dg >= 10 ? 0.8 : dg >= 4 ? 0.4 : dg >= 2 ? 0.15 : 0), al = g.flash ? (dm ? 0.25 : 1) : 0;
  x.globalAlpha = 1; x.fillStyle = g.flash ? (dm ? '#181220' : '#2b2338') : '#0f0b16'; x.fillRect(0, 0, 960, 540);
  x.strokeStyle = '#5c4a70'; x.lineWidth = 4;
  const panel = (px, py, w, h, shut) => { x.fillStyle = shut ? '#4a3b5c' : '#05030a'; x.fillRect(px, py, w, h); x.strokeRect(px, py, w, h); };
  if (v === 'MOVE') {   // placeholder for the walking animation
    const t = Math.min(1, (performance.now() - g.mvAt) / MOVE_MS), w = 150 + 700 * t, h = 300 + 240 * t;
    x.fillStyle = '#05030a'; x.fillRect(480 - w / 2, 270 - h / 2, w, h); x.strokeRect(480 - w / 2, 270 - h / 2, w, h);
  } else if (v === 'CENTER') {
    panel(60, 130, 150, 300, g.doors.LEFT); panel(750, 130, 150, 300, g.doors.RIGHT);
    panel(410, 70, 140, 200, g.doors.CLOSET); panel(300, 350, 360, 120, false);
  } else if (v === 'LEFT' || v === 'RIGHT') {
    const a = v === 'LEFT' ? b.bonnie : b.chica, c = v === 'LEFT' ? COL.bonnie : COL.chica, shut = g.doors[v];
    panel(300, 60, 360, 440, shut);
    if (!shut) {
      const f = b.foxy, s = b.boss;
      if (a.loc === 2) fig(x, 480, 330, 0.35, c, al);
      if (a.loc === 3) fig(x, 480, 500, 1.3, c, al);
      if (f.loc === SIDE[v].hall) fig(x, 480, 330, 0.35, COL.foxy, al);
      if (s.loc === SIDE[v].hall) fig(x, 480, s.fl ? 500 : 330, s.fl ? 1.3 : 0.35, COL.boss, al);
    }
  } else if (v === 'BED') {
    panel(160, 220, 640, 220, false);
    x.fillStyle = '#8a6440'; x.globalAlpha = al;
    for (let i = 0; i < g.freddles; i++) { x.beginPath(); x.arc(320 + i * 160, 250, 34, 0, 7); x.fill(); }
    x.globalAlpha = 1;
    x.globalAlpha = al; x.fillStyle = '#c98a8a'; x.beginPath(); x.arc(480, 380, 22, 0, 7); x.fill(); x.globalAlpha = 1; // Freddy plush nose
    if (b.boss.loc === 'BED') fig(x, 480, 400, 1.2, COL.boss, al);
  } else {
    const f = b.foxy, fs = FS(f), shut = g.doors.CLOSET;
    panel(300, 40, 360, 460, shut);
    if (!shut) {
      if (fs === 1) fig(x, 480, 480, 0.3, COL.foxy, al);
      if (fs === 2) fig(x, 480, 480, 0.8, COL.foxy, al);
      if (fs === 3) fig(x, 480, 480, 0.55, COL.foxy, al);
      if (fs === 4) fig(x, 400, 480, 1, COL.foxy, al);
      if (b.boss.loc === 'CLOSET') fig(x, 480, 520, 1.5, COL.boss, al);
    }
  }
}

function hud() {
  const el = performance.now() - G.start, m = Math.floor(el / HOUR * 60), h = Math.min(5, Math.floor(el / HOUR)), b = G.bots;
  $('clock').textContent = (Math.floor(m / 60) % 12 || 12) + ':' + String(m % 60).padStart(2, '0') + ' AM';
  $('view').textContent = 'Night ' + NIGHT + '   ' + (G.view === 'MOVE' ? G.to : G.view);
  $('st').textContent = 'flashlight ' + (G.flash ? 'on' : 'off') + (G.view in G.doors ? ', door ' + (G.doors[G.view] ? 'closed' : 'open') : '');
  const now = performance.now(), s = a => Math.max(0, Math.round((a.at - now) / 1000)) + 's';
  $('dbg').textContent = 'time ' + $('clock').textContent + '  scale x' + TIME_SCALE + '  hour idx ' + h + '\n' +
    ['bonnie', 'chica'].map(n => n + ' ' + ['center', 'side', 'far hall', 'DOOR'][b[n].loc] + ' t ' + b[n].t.toFixed(1) + ' lvl ' + L(n, h) + ' nextCheckAt +' + s(b[n])).join('\n') +
    '\nfoxy ' + (b.foxy.on ? 'closet v ' + b.foxy.v : b.foxy.loc) + ' lvl ' + L('foxy', h) + ' nextCheckAt +' + s(b.foxy) +
    '\nfreddy progress ' + Math.round(b.freddy.p) + ' adds ' + L('freddy', h) + ' nextCheckAt +' + s(b.freddy) +
    '\nboss ' + b.boss.loc + ' lvl ' + L('boss', h) + ' nextCheckAt +' + s(b.boss) +
    '\nview ' + G.view + ' danger ' + danger() + ' idle ' + Math.floor((now - G.run) / 1000) + 's';
  if (DEBUG) drawMap(h);
}

// Debug minimap of the house.   Q W E K   (living room left, center, right, kitchen)
//                               A S D .   (left hall, closet, right hall)
//                               Z X R .   (left door, main room, right door)
//                               . B . .   (bed)
// btw all of this is getting replaced in the next version, these are just placeholders for now
const MAPC = {Q: [0, 0], W: [1, 0], E: [2, 0], K: [3, 0], A: [0, 1], S: [1, 1], D: [2, 1], Z: [0, 2], X: [1, 2], R: [2, 2], B: [1, 3]};
function drawMap(h) {
  const x = $('mm').getContext('2d'), S = 36, b = G.bots, f = b.foxy, s = b.boss;
  const at = k => [4 + MAPC[k][0] * (S + 4), 4 + MAPC[k][1] * (S + 4)];
  x.clearRect(0, 0, 164, 164);
  for (const k in MAPC) { const [px, py] = at(k); x.fillStyle = k === 'S' || k === 'B' ? '#9a9a9a' : k === 'X' ? '#d8d8d8' : '#2b5599'; x.fillRect(px, py, S, S); }
  const dot = (k, slot, col) => { const [px, py] = at(k); x.fillStyle = col; x.fillRect(px + 3 + (slot % 2) * 17, py + 3 + Math.floor(slot / 2) * 17, 14, 14); };
  dot(['W', 'Q', 'A', 'Z'][b.bonnie.loc], 0, '#00e5ff');
  dot(b.chica.k ? 'K' : ['W', 'E', 'D', 'R'][b.chica.loc], 1, '#ffe600');
  dot(f.on ? 'S' : {CENTER: 'W', LSIDE: 'Q', RSIDE: 'E', LHALL: 'A', RHALL: 'D'}[f.loc], 2, '#ff1a1a');
  dot('B', 3, '#ff8000');
  if (L('boss', h) > 0) { const [px, py] = at({CENTER: 'W', LSIDE: 'Q', RSIDE: 'E', LHALL: 'A', RHALL: 'D', BED: 'B', CLOSET: 'S'}[s.loc]); x.fillStyle = '#fff'; x.fillRect(px + 12, py + 12, 12, 12); x.strokeStyle = '#000'; x.lineWidth = 2; x.strokeRect(px + 12, py + 12, 12, 12); }
  const pv = {CENTER: 'X', LEFT: 'Z', RIGHT: 'R', BED: 'B', CLOSET: 'S'}[G.view === 'MOVE' ? G.to : G.view];
  if (pv) { const [px, py] = at(pv); x.strokeStyle = '#4cff4c'; x.lineWidth = 3; x.strokeRect(px + 1.5, py + 1.5, S - 3, S - 3); }
}

function render() {
  if (G.mods.blind) { const x = $('cv').getContext('2d'); x.globalAlpha = 1; x.fillStyle = '#000'; x.fillRect(0, 0, 960, 540); }
  else { draw(); overlay(); }
  hud();
}

const NAV = {CENTER: {L: 'LEFT', R: 'RIGHT', T: 'CLOSET', B: 'BED'}, LEFT: {R: 'CENTER'}, RIGHT: {L: 'CENTER'}, CLOSET: {B: 'CENTER'}, BED: {T: 'CENTER'}};
const ARW = {L: [28, 270, -1, 0], R: [932, 270, 1, 0], T: [480, 28, 0, -1], B: [480, 512, 0, 1]};
const edge = (px, py) => px < 110 ? 'L' : px > 850 ? 'R' : py < 70 ? 'T' : py > 470 ? 'B' : '';
const pt = e => { const r = $('cv').getBoundingClientRect(); return [(e.clientX - r.left) * 960 / r.width, (e.clientY - r.top) * 540 / r.height]; };
let hk = '', hoverT = 0;

function overlay() {
  const x = $('cv').getContext('2d'), v = G.view;
  if (v === 'MOVE') return;
  x.globalAlpha = 0.5; x.fillStyle = '#8a7aa5';
  for (const k in NAV[v]) {
    const [cx, cy, dx, dy] = ARW[k];
    x.beginPath(); x.moveTo(cx + dx * 14, cy + dy * 14);
    x.lineTo(cx - dy * 16 - dx * 10, cy + dx * 16 - dy * 10); x.lineTo(cx + dy * 16 - dx * 10, cy - dx * 16 - dy * 10); x.fill();
  }
  x.globalAlpha = 1;
}

function hold(what, src) {
  if (G.held || G.view === 'MOVE') return;
  const now = performance.now(), b = G.bots;
  G.held = what; G.src = src;
  if (what === 'flash') G.flash = true;
  else {
    G.dv = G.view; G.doors[G.view] = true; G.hs = now;
    if (G.view === 'CLOSET') b.foxy.blk = now;
    for (const n of ['bonnie', 'chica']) // door closed on them in the far hall: they come to the door but cannot be cleared this hold
      if (b[n].side === G.view && b[n].loc === 2) { b[n].loc = 3; b[n].t = 0; b[n].noClear = true; AM.step(b[n].pan, 0.25); }
  }
  check(); if (G.running) render();
}

function nose() {
  G.nose = (G.nose || 0) + 1; AM.tone(0, 880, 0.12, 0.2, 'square');
  if (G.nose >= 15) end(false, 'Foxy got you after too many nose presses.', 'foxy');
}

// walking takes MOVE_MS. While walking you are not looking at anything and cannot use the flashlight or doors.
function go(v) {
  if (G.view === 'MOVE' || v === G.view) return;
  if (G.held) release();
  const now = performance.now();
  if (G.view === 'BED') G.nose = 0; // nose presses reset when you stop viewing the bed
  G.from = G.view; G.to = v; G.view = 'MOVE'; G.mvAt = now; G.run = now; G.bedAt = 0;
  AM.tone(0, 70, 0.1, 0.15);
  check(); if (G.running) render();
}

function arrive() {
  const now = performance.now(), b = G.bots, f = b.foxy, s = b.boss, v = G.to, prev = G.from;
  G.view = v; G.bedAt = v === 'BED' ? now : 0;
  if (f.on && f.v >= 10 && ['LEFT', 'RIGHT', 'BED'].includes(prev)) return end(false, 'Foxy got you.', 'foxy');
  if (v === 'BED') for (const n of ['bonnie', 'chica']) if (b[n].doom) return end(false, (n === 'bonnie' ? 'Bonnie' : 'Chica') + ' waited at the door too long.', n);
  if (v === 'CENTER' && (s.loc === 'BED' || s.loc === 'CLOSET') && now - s.since >= 10000) return end(false, BN() + ' got to you.', 'boss');
  if ((f.loc === 'LHALL' && v === 'RIGHT') || (f.loc === 'RHALL' && v === 'LEFT')) foxyEnter(now);   // he runs into the closet
  if (((s.loc === 'LHALL' && v === 'RIGHT') || (s.loc === 'RHALL' && v === 'LEFT')) && now - s.since >= 10000) bossSet(now, Math.random() < 0.5 ? 'BED' : 'CLOSET');
  for (const n of ['bonnie', 'chica']) if (b[n].loc === 3 && b[n].side === v) AM.breathe(b[n].pan); // listening at the door
  check(); if (G.running) render();
}

function release() {
  if (!G || !G.running || !G.held) return;
  if (G.held === 'door') G.doors[G.dv] = false;
  G.flash = false; G.held = null; check(); if (G.running) render();
}

$('cv').addEventListener('mousedown', e => {
  if ((P && P.on) || !G || !G.running || e.button !== 0) return;
  const [px, py] = pt(e);
  if (G.view === 'BED' && Math.hypot(px - 480, py - 380) <= 22) nose();
});
$('cv').addEventListener('mousemove', e => {
  if (!G || !G.running || G.view === 'MOVE') return;
  const [px, py] = pt(e), k = edge(px, py);
  if (k === hk) return;
  hk = k; clearTimeout(hoverT);
  const t = NAV[G.view][k];
  if (t) hoverT = setTimeout(() => { if (G && G.running) go(t); }, HOVER_MS);
});
$('cv').addEventListener('mouseleave', () => { clearTimeout(hoverT); hk = ''; });
$('cv').addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { pFlash(false); release(); });
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (P && P.on && k === 'f' && !e.repeat) pFlash(true);
  if (e.repeat || !G || !G.running) return;
  if (k === 'f') hold('flash', 'key');
  else if (k === 'e' && G.view in G.doors) hold('door', 'key');
});
addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (P && P.on && k === 'f') pFlash(false);
  if (G && G.src === 'key' && ((k === 'f' && G.held === 'flash') || (k === 'e' && G.held === 'door'))) release();
});

document.addEventListener('visibilitychange', () => {
  if (!G || !G.running) return;
  const now = performance.now();
  if (document.hidden) { G.hid = now; release(); return; }
  const d = now - G.hid; G.start += d; G.run += d; if (G.mvAt) G.mvAt += d; if (G.bedAt) G.bedAt += d; G.last = now;
  Object.values(G.bots).forEach(a => ['at', 'dl', 'full', 'blk', 'since', 'fl', 'fk'].forEach(k => { if (a[k]) a[k] += d; }));
  lock();
});

// Plushtrap / Nightmare Balloon Boy minigame, on the same clock as the night: 1 original second = OT real seconds.
// Layout:   -C-     Aggression grows per frame while the light is off. Every 2 original seconds he moves if
//           D-D     aggression >= a random 400-499. Flash him on the X within 2 s (0.5 s for Balloon Boy, real time) to win.
//           -H-     Limits below are in original seconds: 90, 60, 45 before nights 2, 3, 4, then 30.
//           D-D
//           -X-
// this ones are also getting changed in the next version, but for now they are just placeholders
let P = null, MINI = 'plush';
const MODS = {blind: false, foxy: false, mad: false, nm: false};
const fmt = ms => { const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };
function startMini(next) {
  const nbb = MINI === 'nbb', now = performance.now();
  P = {on: true, nbb, next, skip: 0, stage: 0, side: 1, aggr: 0, bonus: Math.floor(Math.random() * 3), moved: false, flash: false, xAt: 0,
    ot: 0, last: now, mvOt: 2000, limit: [90, 60, 45, 30][Math.max(0, Math.min(3, next - 2))]};
  P.iv = setInterval(pTick, 100);
  $('dbg').classList.toggle('on', DEBUG); $('mm').classList.remove('on');
  show('game'); pDraw();
}
function pTick() {
  if (!P || !P.on) return;
  const now = performance.now();
  if (document.hidden) { P.last = now; return; }
  const dt = (now - P.last) / OT; P.last = now; P.ot += dt; // dt and ot in original ms
  if (P.ot >= P.limit * 1000) return pEnd(false, 'Time ran out.');
  if (!P.flash) P.aggr += dt * 0.06 * (1 + P.bonus); // per frame at 60 fps: 1 plus a random bonus
  if (P.ot >= P.mvOt) {
    P.mvOt += 2000;
    if (P.nbb && Math.random() < 1 / 3) AM.tone(0, 700, 0.2, 0.12, 'triangle');
    if (P.stage < 5 && P.aggr >= 400 + Math.floor(Math.random() * 100)) pMove(now);
  }
  pDraw();
}
function pMove(now) {
  const s = ++P.stage;
  if (s === 2 || s === 4) P.side = Math.random() < 0.5 ? -1 : 1;
  AM.step(s === 2 || s === 4 ? P.side : 0, 0.3);
  if (s === 5) { P.xAt = now; if (P.nbb) AM.tone(0, 700, 0.3, 0.2, 'triangle'); }
  P.aggr = 200; P.moved = true; P.bonus = Math.floor(Math.random() * (P.nbb ? 5 : 3)); // Balloon Boy: 0-2 at first, 0-4 after his first move
}
function pFlash(on) {
  if (!P || !P.on || P.flash === on) return;
  P.flash = on;
  if (on) {
    if (P.stage === 5) return pEnd(performance.now() - P.xAt <= (P.nbb ? 500 : 2000), 'Too slow, he got you.');
    P.aggr = 0; if (P.stage === 1) P.stage = 0;
  }
  pDraw();
}
function pEnd(win, why) {
  clearInterval(P.iv); P.on = false; P.skip = win ? (P.nbb ? 1 : 2) : 0;
  if (!win) AM.scare();
  $('mt').textContent = win ? (P.nbb ? 'Balloon Boy is on the X' : 'Plushtrap is on the X') : 'You lost him';
  $('mp').textContent = win ? 'Night ' + P.next + ' starts ' + P.skip + (P.skip > 1 ? ' hours' : ' hour') + ' in.' : why + ' Night ' + P.next + ' starts at 12 AM.';
  $('mgo').textContent = 'Start Night ' + P.next;
  show('mres');
}
function pDraw() {
  const x = $('cv').getContext('2d'), s = P.stage, L2 = 250, R2 = 710, sd = P.side < 0 ? L2 : R2;
  x.globalAlpha = 1; x.fillStyle = P.flash ? '#2b2338' : '#0f0b16'; x.fillRect(0, 0, 960, 540);
  x.strokeStyle = '#5c4a70'; x.lineWidth = 4;
  x.strokeRect(430, 40, 100, 30); // C
  for (const y of [150, 355]) for (const dx of [L2, R2]) x.strokeRect(dx - 45, y, 90, 100); // D-D twice
  x.strokeRect(400, 285, 160, 30); // H
  x.strokeStyle = '#7d6f93'; x.beginPath(); x.moveTo(455, 470); x.lineTo(505, 520); x.moveTo(505, 470); x.lineTo(455, 520); x.stroke(); // X
  if (P.flash) {
    const pos = [[480, 110, 0.4], [480, 170, 0.4], [sd, 245, 0.4], [480, 345, 0.4], [sd, 450, 0.45], [480, 530, 0.5]][s];
    fig(x, pos[0], pos[1], pos[2], P.nbb ? '#c06060' : '#5a8a4a', 1);
  }
  $('clock').textContent = P.nbb ? 'Balloon Boy' : 'Plushtrap';
  $('view').textContent = fmt((P.limit * 1000 - P.ot) * OT) + ' left';
  $('st').textContent = 'hold F for the flashlight, flash him when he is on the X';
  $('dbg').textContent = 'minigame ' + (P.nbb ? 'balloon boy' : 'plushtrap') + ' stage ' + s + ' side ' + (P.side < 0 ? 'L' : 'R') +
    '\naggression ' + Math.round(P.aggr) + ' bonus ' + P.bonus + '\nnext opportunity in ' + fmt((P.mvOt - P.ot) * OT) + '\nlimit ' + P.limit + ' original s';
}

const start = (n, skip = 0, mods) => { AM.init(); lock(); newGame(n, skip, mods); };
$('go').onclick = () => { AM.init(); show('nights'); };
for (let i = 1; i <= 8; i++) { const b = document.createElement('button'); b.textContent = 'Night ' + i; b.onclick = () => start(i); $('nl').appendChild(b); }
document.querySelectorAll('.retry').forEach(b => b.onclick = () => start(NIGHT, 0, G ? G.mods : undefined));
document.querySelectorAll('.next').forEach(b => b.onclick = () => {
  const mods = Object.values(G.mods).some(Boolean);
  if (!mods && NIGHT <= 7) { AM.init(); startMini(NIGHT + 1); } else start(NIGHT + 1);
});
$('mgo').onclick = () => start(P.next, P.skip);
const modBtn = (label, on) => { const b = document.createElement('button'); b.textContent = label; b.setAttribute('aria-pressed', 'false'); b.onclick = () => b.setAttribute('aria-pressed', String(on(b))); $('mods').appendChild(b); };
[['Blind Mode', 'blind'], ['Insta-Foxy', 'foxy'], ['Mad Freddy', 'mad'], ['All Nightmare', 'nm']].forEach(([l, k]) => modBtn(l, () => (MODS[k] = !MODS[k])));
modBtn('Start challenge (Night 7)', () => { start(7, 0, {...MODS}); return false; });
modBtn('Minigame: Plushtrap', b => { MINI = MINI === 'plush' ? 'nbb' : 'plush'; b.textContent = 'Minigame: ' + (MINI === 'plush' ? 'Plushtrap' : 'Balloon Boy'); return false; });
modBtn('Practice minigame', () => { AM.init(); startMini(2); return false; });
document.querySelectorAll('.menu').forEach(b => b.onclick = () => show('nights'));
// ~spread the love~