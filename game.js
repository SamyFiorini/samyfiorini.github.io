'use strict';
// 1 = real time (6 hours). Use 60 or 360 to test. Scales the clock and AI check
// intervals. Player reaction timers (15s, 45s, 2s) stay in real seconds.
const TIME_SCALE = 1;
const HOUR = 3600000 / TIME_SCALE, MIN = 60000 / TIME_SCALE;
const LV = {bonnie:[2,3,4,5,7,9], chica:[2,3,4,5,7,9], foxy:[0,1,2,4,5,7], freddy:[0,1,2,3,4,5]};
const COL = {bonnie:'#7a5bb5', chica:'#e0a93b', foxy:'#b5452f'};
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
  step(pan) { this.tone(pan, 60, 0.12, 0.7); setTimeout(() => this.tone(pan, 52, 0.12, 0.6), 300); },
  breathe(pan) { this.hiss(pan, 1.8, 0.35, 600); },
  scare() { [110, 165, 220, 331].forEach(f => this.tone(0, f, 1.2, 0.35, 'sawtooth')); this.hiss(0, 1.2, 0.6, 8000); }
};

let G = null, timer = null, wl = null;
async function lock() { try { if ('wakeLock' in navigator) wl = await navigator.wakeLock.request('screen'); } catch (e) {} }
const bot = (min, max, extra) => Object.assign({stage: 0, min, max, at: 0, dl: 0, full: 0, blk: 0}, extra);
const schedule = a => { a.at = performance.now() + rnd(a.min, a.max) * MIN; };

function show(id) { document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id)); }

function newGame() {
  const now = performance.now();
  G = {start: now, view: 'CENTER', flash: false, running: true, hid: 0, n: 0, lc: 0, freddles: 0,
    doors: {LEFT: false, RIGHT: false, CLOSET: false},
    bots: {bonnie: bot(3, 5, {side: 'LEFT', pan: -1}), chica: bot(3, 5, {side: 'RIGHT', pan: 1}),
           foxy: bot(8, 12), freddy: bot(10, 15)}};
  Object.values(G.bots).forEach(schedule);
  if (timer) clearInterval(timer);
  timer = setInterval(tick, 1000);
  $('dbg').classList.toggle('on', TIME_SCALE !== 1);
  show('game'); render();
}

function end(win, why) {
  G.running = false; clearInterval(timer);
  if (wl) { wl.release().catch(() => {}); wl = null; }
  if (!win) { AM.scare(); $('why').textContent = why; }
  show(win ? 'win' : 'over');
}

function check() {
  const g = G, b = g.bots, now = performance.now();
  if (g.flash) for (const n of ['bonnie', 'chica'])
    if (g.view === b[n].side && b[n].stage === 3) return end(false, 'The flashlight gave you away.');
  if (b.foxy.stage === 4) {
    if (['LEFT', 'RIGHT', 'BED'].includes(g.view)) return end(false, 'You looked away while Foxy was out.');
    if (now >= b.foxy.dl) return end(false, 'Foxy ran out of patience.');
  }
  if (b.freddy.full && now - b.freddy.full >= 5 * MIN) return end(false, 'The Freddles took over.');
}

function tick() {
  if (!G || !G.running || document.hidden) return;
  const now = performance.now(), el = now - G.start;
  if (el >= 6 * HOUR) return end(true);
  const h = Math.floor(el / HOUR), b = G.bots; G.n++;
  for (const n of ['bonnie', 'chica']) {
    const a = b[n], shut = G.doors[a.side];
    if (now >= a.at) {
      schedule(a);
      if (roll(LV[n][h])) {
        if (a.stage < 3) { a.stage++; AM.step(a.pan); }
        else if (!shut) return end(false, 'The door was open.');
      }
    }
    if (shut && a.stage >= 2) {
      a.blk = a.blk || now;
      if (now - a.blk >= 15000) { a.stage = 0; a.blk = 0; }
    } else a.blk = 0;
    if (a.stage === 3 && G.n % 4 === 0) AM.breathe(a.pan);
  }
  const f = b.foxy;
  if (now >= f.at) {
    schedule(f);
    if (f.stage < 4 && roll(LV.foxy[h])) { f.stage++; if (f.stage === 4) f.dl = now + 45000; }
  }
  const y = b.freddy;
  if (now >= y.at) {
    schedule(y);
    if (G.view !== 'BED' && G.freddles < 3 && roll(LV.freddy[h])) { G.freddles++; if (G.freddles === 3) y.full = now; }
  }
  if (G.view === 'BED' && G.flash && G.freddles > 0 && now - G.lc >= 2000) { G.freddles--; G.lc = now; }
  if (G.freddles < 3) y.full = 0;
  check(); if (G.running) render();
}

function fig(x, cx, by, s, col, a) {
  x.globalAlpha = a; x.fillStyle = col;
  x.fillRect(cx - 25 * s, by - 110 * s, 50 * s, 110 * s);
  x.beginPath(); x.arc(cx, by - 128 * s, 24 * s, 0, 7); x.fill();
  x.fillStyle = '#fff'; x.fillRect(cx - 14 * s, by - 134 * s, 8 * s, 8 * s); x.fillRect(cx + 6 * s, by - 134 * s, 8 * s, 8 * s);
  x.globalAlpha = 1;
}

function draw() {
  const x = $('cv').getContext('2d'), g = G, v = g.view, b = g.bots, al = g.flash ? 1 : 0.18;
  x.globalAlpha = 1; x.fillStyle = g.flash ? '#2b2338' : '#0f0b16'; x.fillRect(0, 0, 960, 540);
  x.strokeStyle = '#5c4a70'; x.lineWidth = 4;
  const panel = (px, py, w, h, shut) => { x.fillStyle = shut ? '#4a3b5c' : '#05030a'; x.fillRect(px, py, w, h); x.strokeRect(px, py, w, h); };
  if (v === 'CENTER') {
    panel(60, 130, 150, 300, g.doors.LEFT); panel(750, 130, 150, 300, g.doors.RIGHT);
    panel(410, 70, 140, 200, g.doors.CLOSET); panel(300, 350, 360, 120, false);
  } else if (v === 'LEFT' || v === 'RIGHT') {
    const a = v === 'LEFT' ? b.bonnie : b.chica, c = v === 'LEFT' ? COL.bonnie : COL.chica, shut = g.doors[v];
    panel(300, 60, 360, 440, shut);
    if (!shut) {
      if (a.stage === 1) fig(x, 480, 330, 0.35, c, al * 0.6);
      if (a.stage === 2) fig(x, 480, 460, 0.8, c, al);
      if (a.stage === 3) fig(x, 480, 500, 1.3, c, Math.max(al, 0.3));
    }
  } else if (v === 'BED') {
    panel(160, 220, 640, 220, false);
    x.fillStyle = '#8a6440'; x.globalAlpha = Math.max(al, 0.3);
    for (let i = 0; i < g.freddles; i++) { x.beginPath(); x.arc(320 + i * 160, 250, 34, 0, 7); x.fill(); }
    x.globalAlpha = 1;
  } else {
    const f = b.foxy, shut = g.doors.CLOSET;
    panel(300, 40, 360, 460, shut);
    if (!shut) {
      if (f.stage === 1) fig(x, 480, 480, 0.3, COL.foxy, al);
      if (f.stage === 2) fig(x, 480, 480, 0.8, COL.foxy, al);
      if (f.stage === 3) fig(x, 400, 480, 1, COL.foxy, al);
      if (f.stage === 4) fig(x, 480, 520, 1.5, COL.foxy, Math.max(al, 0.4));
    }
  }
}

function hud() {
  const el = performance.now() - G.start, m = Math.floor(el / HOUR * 60), h = Math.min(5, Math.floor(el / HOUR)), b = G.bots;
  $('clock').textContent = (Math.floor(m / 60) % 12 || 12) + ':' + String(m % 60).padStart(2, '0') + ' AM';
  $('view').textContent = G.view;
  $('st').textContent = 'flashlight ' + (G.flash ? 'on' : 'off') + (G.view in G.doors ? ', door ' + (G.doors[G.view] ? 'closed' : 'open') : '');
  const now = performance.now(), s = a => Math.max(0, Math.round((a.at - now) / 1000)) + 's';
  $('dbg').textContent = 'time ' + $('clock').textContent + '  scale x' + TIME_SCALE + '  hour lvl idx ' + h + '\n' +
    ['bonnie', 'chica', 'foxy'].map(n => n + ' stage ' + b[n].stage + ' lvl ' + LV[n][h] + ' nextCheckAt +' + s(b[n])).join('\n') +
    '\nfreddy freddles ' + G.freddles + ' lvl ' + LV.freddy[h] + ' nextCheckAt +' + s(b.freddy) +
    (b.foxy.dl ? '\nfoxy deadline +' + Math.round((b.foxy.dl - now) / 1000) + 's' : '');
}

function render() { draw(); hud(); }

function toggleDoor() {
  const d = G.view; if (!(d in G.doors)) return;
  G.doors[d] = !G.doors[d];
  if (d === 'CLOSET' && G.doors.CLOSET) { const f = G.bots.foxy; if (f.stage > 0) { f.stage = Math.max(0, f.stage - 2); f.dl = 0; } }
}

addEventListener('keydown', e => {
  if (e.code === 'Space') e.preventDefault();
  if (!G || !G.running || e.repeat) return;
  const k = e.key.toLowerCase(), nav = {a: 'LEFT', d: 'RIGHT', s: 'BED', w: 'CLOSET'};
  if (e.code === 'Space') G.view = 'CENTER';
  else if (nav[k]) G.view = nav[k];
  else if (k === 'f') G.flash = !G.flash;
  else if (k === 'e') toggleDoor();
  else if (k === '`') $('dbg').classList.toggle('on');
  else return;
  check(); if (G.running) render();
});

document.addEventListener('visibilitychange', () => {
  if (!G || !G.running) return;
  const now = performance.now();
  if (document.hidden) { G.hid = now; return; }
  const d = now - G.hid; G.start += d; G.lc += d;
  Object.values(G.bots).forEach(a => ['at', 'dl', 'full', 'blk'].forEach(k => { if (a[k]) a[k] += d; }));
  lock();
});

$('go').onclick = () => { AM.init(); lock(); newGame(); };
document.querySelectorAll('.again').forEach(b => b.onclick = () => { AM.init(); lock(); newGame(); });
