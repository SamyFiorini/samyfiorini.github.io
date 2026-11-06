let visualDepth = 0;
/* ---------- drifting specks (marine snow, with the odd fleck of gold) ---------- */
(function () {
  const c = document.getElementById('particles');
  if (!c) return;
  const ctx = c.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, specks = [], shown = 0;
  const bubs = [];

  function make(anywhere) {
    return {
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: Math.random() * 1.4 + 0.3,
      v: Math.random() * 0.12 + 0.03,
      d: Math.random() * Math.PI * 2,
      a: Math.random() * 0.35 + 0.08,
      gold: Math.random() < 0.07,
      glow: Math.random() < 0.1,
      gr: Math.random() * 4 + 2.5
    };
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    specks = Array.from({ length: Math.round((w * h) / 18000) }, () => make(true));
  }
  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    shown += (visualDepth - shown) * 0.01;
    const glowK = Math.min(1, Math.max(0, (shown - 0.4) / 0.4));
    if (!reduce && Math.random() < 0.012 + 0.04 * shown) {
      bubs.push({ x: Math.random() * w, y: h + 12, r: 1.5 + Math.random() * 3.5, v: 0.5 + Math.random() * 0.7, d: Math.random() * 6.28, a: 0.16 + Math.random() * 0.2 });
    }
    for (let i = bubs.length - 1; i >= 0; i--) {
      const b = bubs[i];
      b.y -= b.v; b.x += Math.sin(t / 700 + b.d) * 0.35;
      if (b.y < -12) { bubs.splice(i, 1); continue; }
      ctx.beginPath(); ctx.lineWidth = 0.9; ctx.strokeStyle = `rgba(190,215,255,${b.a})`;
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.fillStyle = `rgba(230,240,255,${b.a + 0.1})`;
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.5, b.r * 0.2), 0, Math.PI * 2); ctx.fill();
    }
    for (const s of specks) {
      s.y -= s.v * (1 - 0.45 * shown);
      s.x += Math.sin(t / 4000 + s.d) * 0.12;
      if (s.y < -10) Object.assign(s, make(false));
      if (s.glow && glowK > 0.02) {
        const a = glowK * 0.4 * (0.55 + 0.45 * Math.sin(t / 1100 + s.d * 3));
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.gr * 3);
        g.addColorStop(0, `rgba(127,214,194,${a})`); g.addColorStop(1, 'rgba(127,214,194,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.gr * 3, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.fillStyle = s.gold ? `rgba(212,175,106,${s.a + 0.1})` : `rgba(190,210,255,${s.a})`;
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();

/* ---------- game state ---------- */
let dictionarySet = new Set();
let dictionaryArray = [];
let commonRank = new Map();      // everyday word -> rank (0 = most common)
let idxAll = new Map();         // prefix (1-3 letters) -> plain words, easiest first
let idxCommon = new Map();      // same, everyday words only
let sortedAll = [], sortedCommon = [];   // alphabetical lists, used to find words by 4 to 6 starting letters
let strictSet = new Set();
let strictAvailable = false;
let dictionaryReady = false;
let strictMode = false;
let usedWords = new Set();
let currentRule = "weighted";
let activeTailLength = 1;
let requiredPrefix = "";
let turnTimer = null;
const TURN_SECONDS = 20;
let timeLeft = TURN_SECONDS;
let isPlayerTurn = true;
let score = 0;
let streak = 0;
let isGameActive = false;
let matchWords = 0;   // words the player has played this match
let matchLog = [];    // each word the player played this match: { word, points, secs, tail }
let matchBad = 0;     // wrong guesses this match
let matchStart = null; // what the records looked like when the match began, so we can tell what is new
let typeOfGem = 'broken';
const GEM_NAME = { broken: 'Broken', impure: 'Impure', perfect: 'Perfect' };

const EMPTY_HTML = '<div class="empty">The water is still. Press start when you are ready.</div>';

/* ---------- elements ---------- */
const playerInput = document.getElementById('player-input');
const wordForm = document.getElementById('word-form');
const btnSubmit = document.getElementById('btn-submit');
const btnStart = document.getElementById('btn-start');
const btnGiveUp = document.getElementById('btn-give-up');
const targetPrefixDisplay = document.getElementById('target-prefix-display');
const targetMeta = document.getElementById('target-meta');
const timerDisplay = document.getElementById('timer-display');
const timerBar = document.getElementById('timer-bar');
const timerWrap = document.getElementById('timer-wrap');
const chainFeed = document.getElementById('chain-feed');
const statusMessage = document.getElementById('status-message');
const dictionaryStatus = document.getElementById('dictionary-status');
const headerScore = document.getElementById('header-score');
const headerStreak = document.getElementById('header-streak');
const chainLengthBadge = document.getElementById('chain-length-badge');
const modeBtns = document.querySelectorAll('.mode-btn[data-rule]');
const gemBtns = document.querySelectorAll('.gem-btn');
const strictToggle = document.getElementById('strict-mode');
const probStageLabel = document.getElementById('prob-stage-label');
const gameOverSuggestions = document.getElementById('game-over-suggestions');
const suggestionWordsList = document.getElementById('suggestion-words-list');
const suggestionPrefixBadge = document.getElementById('suggestion-prefix-badge');
const modalInstructions = document.getElementById('modal-instructions');
const btnHowToPlay = document.getElementById('btn-how-to-play');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnModalOk = document.getElementById('btn-modal-ok');

/* ---------- words ---------- */
const topCommonWords = ["the","be","to","of","and","a","in","that","have","i","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","would","there","their","what","so","up","out","if","about","who","get","which","go","me","when","make","can","like","time","no","just","him","know","take","people","into","year","your","good","some","could","them","see","other","than","then","now","look","only","come","its","over","think","also","back","after","use","two","how","our","work","first","well","way","even","new","want","because","any","these","give","day","most","us","ear","elf","elephant","orange","apple","dragon","onion","online","ring","river","water","yellow","ghost","tree","engine","game","king","time","yard","earth","hero","wave","element","tiger","rabbit","train","nest","turtle","eagle","monster","terrain"];

function getWordComplexity(word) {
  let s = word.length * 10;
  const r = commonRank.get(word);
  if (r !== undefined) s -= r < 3000 ? 50 : r < 12000 ? 35 : 20;
  s += (word.match(/[qzxj]/g) || []).length * 15;
  return s + (r !== undefined ? r / 1e5 : 1);
}

// score every word once, then sort (much faster than scoring inside the comparison)
function sortByComplexity(words) {
  return words.map(w => [w, getWordComplexity(w)]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
}

// prefix (1 to 3 letters) -> words, keeping the easiest-first order
function buildIndex(words) {
  const m = new Map();
  for (const w of words) {
    for (let n = 1; n <= 3 && n <= w.length; n++) {
      const k = w.slice(0, n);
      let a = m.get(k);
      if (!a) { a = []; m.set(k, a); }
      a.push(w);
    }
  }
  return m;
}

function currentIndex(common) { return (strictMode || common) ? idxCommon : idxAll; }

// words in an alphabetical list that start with a prefix: [first, end) positions
function prefixRange(arr, prefix) {
  const bound = (key) => { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] < key) lo = mid + 1; else hi = mid; } return lo; };
  return [bound(prefix), bound(prefix + '\uffff')];
}
const sortedList = (common) => ((strictMode || common) ? sortedCommon : sortedAll);

// how many words start with this prefix (cheap, nothing is built)
function prefixCount(prefix, common) {
  if (prefix.length <= 3) { const a = currentIndex(common).get(prefix); return a ? a.length : 0; }
  const r = prefixRange(sortedList(common), prefix);
  return r[1] - r[0];
}

// common = true looks only in the everyday list (common.txt), whatever mode you are playing in
function usableWords(prefix, common) {
  if (prefix.length <= 3) {
    const src = currentIndex(common).get(prefix);
    return src ? src.filter(w => !usedWords.has(w)) : [];
  }
  const arr = sortedList(common), r = prefixRange(arr, prefix);
  return sortByComplexity(arr.slice(r[0], r[1]).filter(w => !usedWords.has(w)));
}

// a tail is only handed out when enough words can follow it, and a couple of them are everyday words
const MIN_FOLLOWUPS = { 1: 1, 2: 8, 3: 8, 4: 5, 5: 4, 6: 3 };
function tailOk(prefix) {
  const need = MIN_FOLLOWUPS[prefix.length] || 1;
  if (need <= 1) return hasUsable(prefix);
  let total = 0, everyday = 0;
  const visit = (w) => {
    if (usedWords.has(w)) return false;
    total++;
    if (commonRank.has(w) && commonRank.get(w) < 20000) everyday++;
    return total >= need && everyday >= 2;
  };
  if (prefix.length <= 3) {
    const src = currentIndex().get(prefix);
    if (!src) return false;
    for (const w of src) if (visit(w)) return true;
    return false;
  }
  const arr = sortedList(), r = prefixRange(arr, prefix);
  for (let i = r[0]; i < r[1]; i++) if (visit(arr[i])) return true;
  return false;
}

function hasUsable(prefix) {
  if (prefix.length <= 3) {
    const src = currentIndex().get(prefix);
    if (!src) return false;
    for (const w of src) if (!usedWords.has(w)) return true;
    return false;
  }
  const arr = sortedList(), r = prefixRange(arr, prefix);
  for (let i = r[0]; i < r[1]; i++) if (!usedWords.has(arr[i])) return true;
  return false;
}

const builtInFallbackWords = [
  "apple","ant","anchor","album","artist","arrow","angel","animal",
  "bear","ball","book","bird","boat","bridge","banana","butter","brain",
  "cat","car","city","cloud","crown","clock","camel","coffee","castle",
  "dog","duck","door","dragon","doctor","desk","driver","diamond",
  "ear","elf","elephant","eagle","earth","engine","energy","egg","element",
  "fox","fish","fire","flower","forest","feather","fruit","frog",
  "ghost","game","green","garden","giant","glass","gold","grape",
  "hero","horse","house","heart","honey","hammer","hill","hospital",
  "iron","ice","island","insect","item","image","ink","ivory",
  "jungle","jewel","jacket","juice","journey","judge","jet",
  "king","kite","key","kitchen","knight","kangaroo",
  "lion","lamp","leaf","lemon","lizard","letter","library","light",
  "monster","moon","monkey","mountain","music","mirror","magic","market",
  "nest","night","needle","number","nature","notebook","nerve",
  "orange","onion","online","owl","ocean","office","orbit","otter",
  "pencil","paper","planet","park","python","palace","pepper","piano",
  "queen","quartz","quick","quiet","quill",
  "rabbit","river","ring","robot","rocket","rainbow","radio","rose",
  "sun","star","snake","silver","spider","shadow","shield","school",
  "tiger","turtle","train","tree","terrain","tower","tunnel",
  "umbrella","uncle","unit","universe","urban",
  "valley","volcano","village","violin","vault","vector",
  "water","wave","wind","wolf","wizard","wheel","weapon",
  "xenon","xylophone",
  "yellow","yard","yacht","yeast","yogurt",
  "zebra","zero","zoo","zone"
];

function setDictStatus(html) {
  if (dictionaryStatus) dictionaryStatus.innerHTML = html;
}

function installDictionary(everything, plainList, commonList) {
  commonRank = new Map(commonList.map((w, i) => [w, i]));   // must come first, the sort uses it
  dictionarySet = everything;
  const plainSet = new Set(plainList);
  dictionaryArray = sortByComplexity(plainList);
  idxAll = buildIndex(dictionaryArray);
  sortedAll = plainList.slice().sort();
  const commonPlain = commonList.filter(w => plainSet.has(w));
  strictSet = new Set(commonPlain);
  idxCommon = buildIndex(sortByComplexity(commonPlain));
  sortedCommon = commonPlain.slice().sort();
  strictAvailable = commonPlain.length > 500;
  applyStrictAvailability();
}

function applyStrictAvailability() {
  if (!strictToggle) return;
  const label = strictToggle.closest('.toggle');
  strictToggle.disabled = !strictAvailable;
  if (label) {
    label.classList.toggle('is-disabled', !strictAvailable);
    label.title = strictAvailable ? 'Only everyday words, for you and the gem' : 'The everyday words list (common.txt) could not be loaded';
  }
  if (!strictAvailable) strictMode = false;
  strictToggle.checked = strictMode;
  syncStrictLock();
}

// tries each address in turn, returns the text or null
async function fetchText(urls) {
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) return await r.text();
    } catch (e) { /* try the next one */ }
  }
  return null;
}

// words.txt and common.txt sit next to this page (GitHub Pages serves them compressed).
// If words.txt is missing, fall back to the public list on GitHub.
const WORDS_URLS = ['words.txt', 'https://raw.githubusercontent.com/dwyl/english-words/master/words.txt'];
const COMMON_URLS = ['common.txt'];

async function loadDictionary() {
  installDictionary(new Set(builtInFallbackWords), [...builtInFallbackWords], []);
  dictionaryReady = true;
  if (btnStart) btnStart.disabled = false;
  setDictStatus('<span class="dot loading"></span>loading the full dictionary');

  const [wordsText, commonText] = await Promise.all([fetchText(WORDS_URLS), fetchText(COMMON_URLS)]);
  if (!wordsText) {
    setDictStatus(`<span class="dot"></span>${builtInFallbackWords.length} words ready (offline set)`);
    return;
  }

  // everything is accepted from you (names and places included),
  // but the gem and the suggestions only draw from the plain lowercase words
  const everything = new Set(builtInFallbackWords);
  const plain = new Set(builtInFallbackWords);
  for (const raw of wordsText.split(/\r?\n/)) {
    const w = raw.trim();
    if (w.length < 2 || !/^[A-Za-z]+$/.test(w)) continue;
    const lower = w.toLowerCase();
    everything.add(lower);
    if (w === lower) plain.add(lower);
  }
  const common = commonText ? commonText.split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];

  installDictionary(everything, [...plain], common);
  const note = strictAvailable ? '' : ', everyday-words mode unavailable';
  setDictStatus(`<span class="dot"></span>${everything.size.toLocaleString()} words ready${note}, plus online lookup for the rest`);
}

/* ---------- settings ---------- */
gemBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (isGameActive || btn.dataset.gem === typeOfGem) return;
    typeOfGem = btn.dataset.gem;
    gemBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
  });
});

// everything that changes the rules is locked while a match is running (type of gem, tail length, common words, Start)
function syncStrictLock() {
  const defBtn = document.getElementById('btn-define');
  if (defBtn) { defBtn.disabled = isGameActive; defBtn.title = isGameActive ? 'Lookups open again when the match is over' : ''; }
  if (isGameActive && typeof Define !== 'undefined') Define.close();
  if (!strictToggle) { return; }
  const label = strictToggle.closest('.toggle');
  const locked = isGameActive || !strictAvailable;
  gemBtns.forEach((b) => { b.disabled = isGameActive; });
  if (btnStart) btnStart.disabled = isGameActive || !dictionaryReady;
  modeBtns.forEach((b) => { b.disabled = isGameActive; });
  strictToggle.disabled = locked;
  if (label) {
    label.classList.toggle('is-disabled', locked);
    label.title = !strictAvailable ? 'The everyday words list (common.txt) could not be loaded'
      : isGameActive ? 'Locked during a match. Change it before you press Start.' : 'Only everyday words, for you and the gem';
  }
}
if (strictToggle) {
  strictToggle.addEventListener('change', () => { if (isGameActive) { strictToggle.checked = strictMode; return; } strictMode = strictToggle.checked; });
}

modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (isGameActive || btn.dataset.rule === currentRule) return;
    modeBtns.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    currentRule = btn.dataset.rule;
    updateProbabilityUI();
  });
});

// six phases, one every 50 of streak: the chance (in percent) of needing to match 1, 2, 3, 4, 5 or 6 letters
const PHASES = [
  ['Shallows', [75, 20, 5, 0, 0, 0]],
  ['Drifting', [50, 35, 13, 2, 0, 0]],
  ['Sinking',  [30, 42, 22, 6, 0, 0]],
  ['Twilight', [18, 38, 30, 12, 2, 0]],
  ['Midnight', [10, 32, 34, 19, 5, 0]],
  ['Abyss',    [5, 25, 35, 24, 10.5, 0.5]]
];

function getProbabilities() {
  const i = Math.min(PHASES.length - 1, Math.floor(streak / 50));
  const range = i === PHASES.length - 1 ? `${i * 50}+` : `${i * 50}-${i * 50 + 49}`;
  return { phase: i, stage: `Phase ${i}: ${PHASES[i][0]} (streak ${range})`, p: PHASES[i][1] };
}

function setOdds(list) {
  list.forEach((v, i) => {
    const val = document.getElementById('prob-val-' + (i + 1));
    const box = document.getElementById('odd-' + (i + 1));
    if (val) val.textContent = v + '%';
    if (box) { box.style.setProperty('--w', v + '%'); box.classList.toggle('zero', v === 0); }
  });
}

function updateProbabilityUI() {
  if (currentRule !== 'weighted') {
    const n = parseInt(currentRule);
    if (probStageLabel) probStageLabel.textContent = `Fixed at ${n} letter${n === 1 ? '' : 's'}${n >= 4 ? ' (shorter when no word can follow)' : ''}`;
    setOdds([1, 2, 3, 4, 5, 6].map((k) => (k === n ? 100 : 0)));
    return;
  }
  const p = getProbabilities();
  if (probStageLabel) probStageLabel.textContent = p.stage;
  setOdds(p.p);
}

function calculateNextTailLength(lastWord) {
  if (!lastWord) return 1;

  let targetLen = 1;
  if (currentRule !== 'weighted') {
    targetLen = parseInt(currentRule);
  } else {
    const p = getProbabilities().p;
    const roll = Math.random() * 100;
    let acc = 0;
    for (let i = 0; i < p.length; i++) { acc += p[i]; if (roll < acc) { targetLen = i + 1; break; } }
  }

  targetLen = Math.min(targetLen, Math.max(1, lastWord.length - 1));

  while (targetLen > 1) {
    if (tailOk(lastWord.slice(-targetLen))) break;
    targetLen--;
  }

  return targetLen;
}

/* ---------- game flow ---------- */
// a random everyday word opens each match, so nobody gets to choose where it starts
// in a fixed 4, 5 or 6 letter match, the gem and the opener aim for words that really end in a good tail of that length
const fixedLong = () => { const n = parseInt(currentRule); return n >= 4 ? n : 0; };
function pickOpener() {
  const pool = [], want = fixedLong();
  if (commonRank.size) {
    for (const [w, rank] of commonRank) {
      if (rank < 8000 && w.length >= 4 && w.length <= 8 && !usedWords.has(w) && hasUsable(w.slice(-1)) && (!want || tailOk(w.slice(-want)))) pool.push(w);
    }
  }
  let src = pool.length ? pool : builtInFallbackWords.filter((w) => w.length >= 4);
  if (want && !pool.length) src = [...commonRank.keys()].filter((w) => w.length > want && w.length <= 12 && commonRank.get(w) < 20000 && tailOk(w.slice(-want)));
  if (!src.length) src = builtInFallbackWords.filter((w) => w.length >= 4);
  return src.length ? src[Math.floor(Math.random() * src.length)] : null;
}

function startGame() {
  if (typeOfGem === 'perfect' && typeof Trap !== 'undefined') Trap.warm();
  if (typeof Results !== 'undefined') Results.close();
  disarmGiveUp();
  usedWords.clear();
  score = 0;
  streak = 0;
  requiredPrefix = "";
  activeTailLength = 1;
  isGameActive = true;
  isPlayerTurn = true;
  syncStrictLock();
  matchWords = 0;
  matchLog = [];
  matchBad = 0;
  { const sd = Stats.get(); matchStart = { rec: JSON.parse(JSON.stringify(records)), longest: sd.longest.len, best: sd.bestWord.points, fastest: sd.fastest, at: Date.now(), gem: typeOfGem }; }
  Stats.startGame();

  updateScoreboard();
  if (chainFeed) chainFeed.innerHTML = '';
  if (chainLengthBadge) chainLengthBadge.textContent = '0 words';
  if (statusMessage) statusMessage.classList.add('quiet');
  if (gameOverSuggestions) gameOverSuggestions.classList.add('hidden');

  if (playerInput) {
    playerInput.disabled = false;
    playerInput.value = '';
    playerInput.focus();
  }
  if (btnSubmit) btnSubmit.disabled = false;
  if (btnGiveUp) btnGiveUp.disabled = false;

  updateProbabilityUI();
  resetBreakdown();
  const opener = pickOpener();
  if (opener) playWord(opener, "Start");
  else { updateTargetDisplay(); startTimer(); }
  resetGuesses();
  prepareInput();
  showStatus(opener ? `The chain opens with "${opener.toUpperCase()}". Your turn.` : "Type any word to open the chain.", "info");
}

function resetGame() {
  disarmGiveUp();
  clearInterval(turnTimer);
  isGameActive = false;
  syncStrictLock();
  requiredPrefix = "";
  if (playerInput) { playerInput.disabled = true; playerInput.value = ''; }
  if (btnSubmit) btnSubmit.disabled = true;
  if (btnGiveUp) btnGiveUp.disabled = true;
  if (chainFeed) chainFeed.innerHTML = EMPTY_HTML;
  if (chainLengthBadge) chainLengthBadge.textContent = '0 words';
  if (gameOverSuggestions) gameOverSuggestions.classList.add('hidden');
  if (statusMessage) statusMessage.classList.add('quiet');
  usedWords.clear();
  updateTargetDisplay();
  timeLeft = TURN_SECONDS;
  if (timerBar) timerBar.classList.add('snap');
  updateTimerDisplay();
  if (timerBar) { void timerBar.offsetWidth; timerBar.classList.remove('snap'); }
  updateProbabilityUI();
  resetGuesses();
}

let lookupBudgetMs = 0;   // how much online-lookup time may be paused this turn

let turnDeadline = 0;     // when this turn ends, by the real clock

function tickTimer() {
  const left = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
  if (left !== timeLeft) { timeLeft = left; updateTimerDisplay(); }
  if (timeLeft <= 0) {
    clearInterval(turnTimer);
    handleTimeOut();
  }
}

function startTimer() {
  clearInterval(turnTimer);
  timeLeft = TURN_SECONDS;
  lookupBudgetMs = 6000;
  turnDeadline = Date.now() + TURN_SECONDS * 1000;
  if (timerBar) timerBar.classList.add('snap');
  updateTimerDisplay();
  if (timerBar) { void timerBar.offsetWidth; timerBar.classList.remove('snap'); }
  turnTimer = setInterval(tickTimer, 250);
}

function resumeTimer() {
  clearInterval(turnTimer);
  turnTimer = setInterval(tickTimer, 250);
}

function updateTimerDisplay() {
  if (timerDisplay) timerDisplay.textContent = `${timeLeft}s`;
  if (timerBar) timerBar.style.width = `${Math.max(0, (timeLeft / TURN_SECONDS) * 100)}%`;
  if (timerWrap) timerWrap.dataset.level = timeLeft <= 5 ? 'low' : timeLeft <= 10 ? 'warn' : 'ok';
}

function handleTimeOut() {
  if (isPlayerTurn) {
    gameOver("Time ran out.");
  } else {
    playerWins("The gem ran out of time.");
  }
}

if (wordForm) {
  wordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isGameActive || !isPlayerTurn) return;

    const word = playerInput.value.trim().toLowerCase();
    if (!word) return;

    if (requiredPrefix && !word.startsWith(requiredPrefix)) {
      showStatus(`The word has to start with "${requiredPrefix.toUpperCase()}".`, "error");
      shakeInput();
      return;
    }

    if (!/^[a-z]+$/.test(word)) {
      showStatus("Words can only use the letters A to Z.", "error");
      shakeInput();
      return;
    }

    if (word.length < 2) {
      showStatus("Words need at least two letters.", "error");
      shakeInput();
      return;
    }

    if (usedWords.has(word)) {
      showStatus(`"${word.toUpperCase()}" was already played in this match.`, "error");
      shakeInput();
      return;
    }

    if (strictMode) {
      if (!strictSet.has(word)) {
        rejectGuess(`"${word.toUpperCase()}" is not an everyday word. Switch off "common words only" to play it.`);
        return;
      }
    } else if (!dictionarySet.has(word)) {
      if (checkingOnline) return;
      checkingOnline = true;
      // the clock waits while we look the word up (up to 6 seconds per turn, so it cannot be abused)
      const paused = lookupBudgetMs > 0;
      if (paused) clearInterval(turnTimer);
      const startedAt = Date.now();
      showStatus(paused ? `Looking up "${word.toUpperCase()}" online. The clock is waiting.` : `Looking up "${word.toUpperCase()}" online...`, "info");
      const found = await existsOnline(word);
      checkingOnline = false;
      if (paused) {
        const spent = Date.now() - startedAt;
        turnDeadline += Math.min(spent, lookupBudgetMs);   // the clock waits, but only while the budget lasts
        lookupBudgetMs -= Math.max(spent, 1000);           // every lookup costs at least a second of it
        if (isGameActive && isPlayerTurn && found !== true) resumeTimer();
      }
      if (!isGameActive || !isPlayerTurn) return;
      if (found === null) {
        showStatus("Could not reach the online dictionary to check that word.", "error");
        shakeInput();
        return;
      }
      if (!found) {
        rejectGuess(`"${word.toUpperCase()}" is not in the dictionary.`);
        return;
      }
      dictionarySet.add(word);
      Stats.bump('onlineWords');
    }

    playWord(word, "Player");
    playerInput.value = '';

    if (isGameActive) {
      isPlayerTurn = false;
      playerInput.disabled = true;
      btnSubmit.disabled = true;
      showStatus("The gem is thinking...", "info");

      const delay = Math.floor(Math.random() * 800) + 600 + (typeOfGem === 'broken' ? 900 : 0);
      setTimeout(gemPlayTurn, delay);
    }
  });
}

function playWord(word, player) {
  usedWords.add(word);

  // score against the tail the word had to match, before the next one is chosen
  if (player === "Player") {
    const r = scoreWord(word, requiredPrefix ? requiredPrefix.length : 1, streak);
    matchWords++;
    matchLog.push({ word, points: r.total, secs: Math.max(0, TURN_SECONDS - timeLeft), tail: requiredPrefix ? requiredPrefix.length : 1 });
    Stats.word(word, r.total, requiredPrefix ? requiredPrefix.length : 1, Math.max(0, TURN_SECONDS - timeLeft));
    score += r.total;
    streak++;
    showBreakdown(r);
  }

  activeTailLength = calculateNextTailLength(word);
  requiredPrefix = word.slice(-activeTailLength);

  updateScoreboard();
  updateProbabilityUI();
  appendChainBadge(word, player);
  updateTargetDisplay();

  startTimer();
}

// chance of each tail length for the next word, so Perfect can aim at it
function tailOdds() {
  if (currentRule !== 'weighted') {
    const n = parseInt(currentRule);
    const o = {};
    for (let k = 1; k <= 6; k++) o[k] = k === n ? 1 : 0;
    return o;
  }
  const p = getProbabilities().p, o = {};
  p.forEach((v, i) => { o[i + 1] = v / 100; });
  return o;
}

// Perfect: choose the word that leaves you the fewest words to answer with
// how many words the player could answer with, on average, after this word (higher = friendlier)
function tailScore(w, odds) {
  let sc = 0;
  for (let n = 1; n <= 6; n++) {
    if (!odds[n] || w.length <= n) continue;
    sc += odds[n] * prefixCount(w.slice(-n));
  }
  return sc;
}

// what each gem knows: Broken only the everyday words, Impure the everyday words first and,
// when those run out, the full list 90% of the time (10% of the time it is stuck), Perfect everything
function gemWords(prefix) {
  if (typeOfGem === 'broken') return usableWords(prefix, true);
  if (typeOfGem === 'impure') {
    const everyday = usableWords(prefix, true);
    if (everyday.length) return everyday;
    return Math.random() < 0.9 ? usableWords(prefix, false) : [];
  }
  return usableWords(prefix, false);
}

function pickGemWord() {
  const all = gemWords(requiredPrefix);
  if (all.length === 0) return null;
  // prefer everyday words so the gem does not play obscure junk
  const everyday = strictMode ? all : all.filter(w => commonRank.has(w));
  let nice = everyday.length >= 5 ? everyday : all;
  const longer = nice.filter(w => w.length >= 3);          // skip two-letter oddities when there are choices
  if (longer.length >= 5) nice = longer;
  if (typeOfGem !== 'perfect' && fixedLong()) {
    const n = fixedLong(), fit = nice.filter(w => w.length > n && tailOk(w.slice(-n)));
    if (fit.length >= 3) nice = fit;
  }
  const odds = tailOdds();
  // Broken and Impure often skip plurals, so the chain does not turn into an endless run of S
  const varied = (list) => {
    if (Math.random() < 0.65) { const f = list.filter(w => !w.endsWith('s')); if (f.length >= 4) return f; }
    return list;
  };
  if (typeOfGem === 'broken') {
    // Broken: short, very common words, and it picks the ones that leave you the most ways to answer
    let pool = nice.filter(w => w.length >= 3 && w.length <= 6 && commonRank.get(w) < 6000);
    if (pool.length < 4) pool = nice.filter(w => w.length <= 7);
    if (pool.length < 4) pool = nice;
    pool = varied(pool).slice(0, 200).sort((a, b) => tailScore(b, odds) - tailScore(a, odds));
    return pool[Math.floor(Math.random() * Math.min(pool.length, 6))];
  }
  if (typeOfGem === 'impure') {
    // Impure: a wide, steady range of everyday words, long and short, with no plan beyond not painting itself into a corner
    let pool = nice.slice(0, 600).filter(w => w.length >= 4 && tailScore(w, odds) >= 3);
    if (pool.length < 8) pool = nice.slice(0, 600);
    pool = varied(pool);
    const long = pool.filter(w => w.length >= 6);
    if (long.length >= 5 && Math.random() < 0.55) pool = long;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Perfect looks at every word it has, not only the everyday ones
  const wide = all.filter(w => w.length >= 3);
  return Trap.pick(wide.length >= 5 ? wide : all, odds);
}

/* ---------- Perfect: the word that leaves you the least ---------- */
// For every start of 1 to 6 letters the table holds how many words begin with it, weighted by how well
// known they are (a word everyone knows counts almost 1, a very obscure one about 0.05), plus how many
// words and how many everyday words there are, so the gem can tell which tails the game will really hand out.
const Trap = (() => {
  const PACK = 1048576;
  const tables = {};
  const weight = (w) => { const r = commonRank.get(w); return 1 / (1 + (r === undefined ? 60000 : r) / 3000); };
  function table(common) {
    const key = common ? 'c' : 'a';
    if (tables[key]) return tables[key];
    const W = new Map(), N = new Map();
    for (const w of (common ? sortedCommon : sortedAll)) {
      const wt = weight(w), r = commonRank.get(w), ev = (r !== undefined && r < 20000) ? PACK : 0;
      for (let k = 1; k <= 6 && k <= w.length; k++) {
        const p = w.slice(0, k);
        W.set(p, (W.get(p) || 0) + wt);
        N.set(p, (N.get(p) || 0) + 1 + ev);
      }
    }
    return (tables[key] = { W, N });
  }
  const total = (T, p) => (T.N.get(p) || 0) % PACK;
  const ok = (T, p) => {
    const v = T.N.get(p); if (!v) return false;
    const need = MIN_FOLLOWUPS[p.length] || 1, t = v % PACK, ev = Math.floor(v / PACK);
    return need <= 1 ? t >= 1 : (t >= need && ev >= 2);
  };
  // the tail the game would really hand out after this word when it rolls n letters
  function tailFor(T, w, n) {
    let t = Math.min(n, Math.max(1, w.length - 1));
    while (t > 1 && !ok(T, w.slice(-t))) t--;
    return w.slice(-t);
  }
  const cost = (T, w, odds) => { let c = 0; for (const n in odds) if (odds[n]) c += odds[n] * (T.W.get(tailFor(T, w, +n)) || 0); return c; };
  // would the gem still have room to move after the player's four easiest answers?
  function safe(T, w, odds, common) {
    for (const n in odds) {
      if (odds[n] < 0.1) continue;
      const e = tailFor(T, w, +n);
      const replies = usableWords(e, common).filter((x) => x !== w).slice(0, 4);
      for (const r of replies) for (const m in odds) {
        if (odds[m] < 0.1) continue;
        if (total(T, tailFor(T, r, +m)) < 3) return false;
      }
    }
    return true;
  }
  return {
    warm() { table(strictMode); },
    cost(w, odds) { return cost(table(strictMode), w, odds); },
    pick(cands, odds) {
      const common = strictMode, T = table(common);
      // a word nobody knows has to be clearly better than a familiar one before the gem picks it
      const scored = cands.map((w) => [cost(T, w, odds) * (commonRank.has(w) ? 1 : 1.3), w]).sort((a, b) => a[0] - b[0]);
      const keep = [];
      for (let i = 0; i < scored.length && keep.length < 8 && i < 60; i++) if (safe(T, scored[i][1], odds, common)) keep.push(scored[i][1]);
      if (!keep.length) return scored[0][1];
      // usually the very best, sometimes one of the next few, so it is not the same word every time
      let r = Math.random() * keep.reduce((a, _, i) => a + 1 / (1 + i), 0);
      for (let i = 0; i < keep.length; i++) { r -= 1 / (1 + i); if (r <= 0) return keep[i]; }
      return keep[0];
    }
  };
})();

function gemPlayTurn() {
  if (!isGameActive) return;

  const selectedWord = pickGemWord();
  if (!selectedWord) {
    const P = requiredPrefix.toUpperCase();
    playerWins(typeOfGem === 'broken' ? `A broken gem only knows everyday words, and it has none left starting with "${P}".`
      : typeOfGem === 'impure' ? `The impure gem could not find a word starting with "${P}".`
      : `The gem could not find a word starting with "${P}".`);
    return;
  }

  playWord(selectedWord, "Gem");

  isPlayerTurn = true;
  if (playerInput) playerInput.disabled = false;
  if (btnSubmit) btnSubmit.disabled = false;
  resetGuesses();
  prepareInput();
  showStatus("Your turn.", "info");
}

/* ---------- online lookup for words the list does not have ---------- */
const onlineCache = new Map();
let checkingOnline = false;

// true = English Wiktionary has it, false = it does not, null = could not reach it
async function existsOnline(word) {
  if (onlineCache.has(word)) return onlineCache.get(word);
  try {
    const cap = word.charAt(0).toUpperCase() + word.slice(1);
    const url = 'https://en.wiktionary.org/w/api.php?action=query&format=json&origin=*&prop=categories&cllimit=50'
      + '&clcategories=' + encodeURIComponent('Category:English lemmas|Category:English non-lemma forms')
      + '&titles=' + encodeURIComponent(word + '|' + cap);
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values((data.query && data.query.pages) || {});
    const found = pages.some(pg => !('missing' in pg) && Array.isArray(pg.categories) && pg.categories.length > 0);
    onlineCache.set(word, found);
    return found;
  } catch (e) {
    return null;
  }
}

/* ---------- scoring ---------- */
// best score remembers the streak it came with, best streak remembers its score
let records = { score: { score: 0, streak: null }, streak: { streak: 0, score: null } };
try {
  const saved = JSON.parse(localStorage.getItem('wordchain-records') || 'null');
  if (saved && saved.score && saved.streak) {
    records = saved;
  } else {
    const old = parseInt(localStorage.getItem('wordchain-best') || '0', 10) || 0;   // the older single best score
    if (old) records.score = { score: old, streak: null };
  }
} catch (e) {}

function updateRecords() {
  let changed = false;
  const rs = records.score;
  if (score > rs.score || (score > 0 && score === rs.score && streak > (rs.streak === null ? -1 : rs.streak))) {
    records.score = { score, streak };
    changed = true;
  }
  const rk = records.streak;
  if (streak > 0 && (streak > rk.streak || (streak === rk.streak && score > (rk.score === null ? -1 : rk.score)))) {
    records.streak = { streak, score };
    changed = true;
  }
  if (changed) {
    try { localStorage.setItem('wordchain-records', JSON.stringify(records)); } catch (e) {}
  }
}

function streakMultiplier(n) {
  return 1 + n * 0.05;
}

function scoreWord(word, tail, streakBefore) {
  const base = word.length * 10;
  const extra = Math.max(0, word.length - 5);
  const lengthBonus = extra * extra * 10;
  const tailMult = 1 + (tail - 1) * 0.5;
  const streakMult = streakMultiplier(streakBefore);
  const total = Math.round((base + lengthBonus) * tailMult * streakMult);
  return { base, lengthBonus, tailMult, streakMult, total };
}

function showBreakdown(r) {
  const el = document.getElementById('score-breakdown');
  if (!el) return;
  const parts = [`word ${r.base}`];
  if (r.lengthBonus) parts.push(`long word +${r.lengthBonus}`);
  if (r.tailMult > 1) parts.push(`tail \u00d7${r.tailMult}`);
  if (r.streakMult > 1) parts.push(`streak \u00d7${r.streakMult.toFixed(2)}`);
  el.innerHTML = `<strong>+${r.total.toLocaleString()}</strong>${parts.join(' \u00b7 ')}`;
}

function resetBreakdown() {
  const el = document.getElementById('score-breakdown');
  if (el) el.textContent = 'Longer words and unbroken streaks score more.';
}

/* ---------- five tries per word ---------- */
const MAX_GUESSES = 5;
let guessesLeft = MAX_GUESSES;
const bubbleBox = document.getElementById('bubbles');

// pop = true plays the pop animation on the bubble that was just lost
function syncBubbles(pop) {
  if (!bubbleBox) return;
  bubbleBox.classList.toggle('idle', !isGameActive);
  bubbleBox.setAttribute('aria-label', `${guessesLeft} ${guessesLeft === 1 ? 'guess' : 'guesses'} left`);
  [...bubbleBox.children].forEach((b, i) => {
    if (i < guessesLeft) { b.className = ''; return; }
    if (b.classList.contains('gone') || b.classList.contains('popping')) return;
    if (pop) {
      b.className = 'popping';
      setTimeout(() => { b.className = 'gone'; }, 520);
    } else {
      b.className = 'gone';
    }
  });
}

function resetGuesses() {
  guessesLeft = MAX_GUESSES;
  syncBubbles(false);
}

// a word that does not exist costs one bubble; the last one ends the match
function rejectGuess(message) {
  Stats.bump('badGuesses');
  matchBad++;
  guessesLeft--;
  syncBubbles(true);
  if (guessesLeft <= 0) {
    gameOver("You ran out of guesses.");
    return;
  }
  showStatus(`${message} ${guessesLeft} ${guessesLeft === 1 ? 'guess' : 'guesses'} left.`, "error");
  shakeInput();
}

/* ---------- the letters you already owe ---------- */
function prepareInput() {
  if (!playerInput) return;
  playerInput.value = requiredPrefix;
  playerInput.focus();
  const n = playerInput.value.length;
  try { playerInput.setSelectionRange(n, n); } catch (e) {}
}

// words have to be typed: no pasting, dropping text in, or tapping a replacement suggestion
if (playerInput) {
  playerInput.setAttribute('autocorrect', 'off');
  const refuse = (e) => { e.preventDefault(); if (isGameActive) { showStatus('Words have to be typed. Pasting is turned off.', 'error'); shakeInput(); } };
  ['paste', 'drop'].forEach((t) => playerInput.addEventListener(t, refuse));
  // swipe typing and tapped suggestions put a whole word in at once; real typing adds a letter at a time
  let before = '';
  playerInput.addEventListener('beforeinput', () => { before = playerInput.value; });
  playerInput.addEventListener('focus', () => { before = playerInput.value; });
  playerInput.addEventListener('input', () => {
    if (isGameActive && playerInput.value.length - before.length > 2) {
      playerInput.value = before;
      showStatus('Swipe typing and word suggestions are turned off. Type the letters one by one.', 'error');
      shakeInput();
      return;
    }
    before = playerInput.value;
  });
  playerInput.addEventListener('beforeinput', (e) => {
    if (['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertReplacementText', 'insertFromYank'].includes(e.inputType)) refuse(e);
  });
}

if (playerInput) {
  playerInput.addEventListener('input', () => {
    if (!isGameActive || !isPlayerTurn || !requiredPrefix) return;
    let v = playerInput.value.toLowerCase();
    if (!v.startsWith(requiredPrefix)) {
      v = requiredPrefix.startsWith(v) ? requiredPrefix : requiredPrefix + v;
    }
    if (v !== playerInput.value) playerInput.value = v;
  });
}

/* ---------- drawing the chain ---------- */
function appendChainBadge(word, player) {
  if (!chainFeed) return;
  const placeholder = chainFeed.querySelector('.empty');
  if (placeholder) placeholder.remove();

  const isPlayer = player === "Player";
  const badge = document.createElement('div');
  badge.className = `word ${isPlayer ? 'you' : 'gem'}`;

  const mainPart = word.slice(0, word.length - activeTailLength);
  const tailPart = word.slice(-activeTailLength);

  badge.innerHTML = `<small>${isPlayer ? 'you' : player === 'Start' ? 'start' : GEM_NAME[typeOfGem].toLowerCase()}</small><span>${mainPart}<em>${tailPart}</em></span>`;

  chainFeed.appendChild(badge);
  chainFeed.scrollTop = chainFeed.scrollHeight;
  if (chainLengthBadge) chainLengthBadge.textContent = `${usedWords.size} word${usedWords.size === 1 ? '' : 's'}`;
}

function updateTargetDisplay() {
  if (!targetPrefixDisplay) return;
  if (!requiredPrefix) {
    targetPrefixDisplay.textContent = "Any word";
    targetPrefixDisplay.classList.add('any');
    if (targetMeta) targetMeta.textContent = isGameActive ? "any word will open the chain" : "press start when you are ready";
  } else {
    targetPrefixDisplay.classList.remove('any');
    targetPrefixDisplay.innerHTML = `${requiredPrefix.toUpperCase()}<i>&hellip;</i>`;
    if (targetMeta) targetMeta.textContent = `${activeTailLength} letter${activeTailLength === 1 ? '' : 's'} to match`;
  }
}

function updateScoreboard() {
  updateRecords();
  if (headerScore) headerScore.textContent = score.toLocaleString();
  if (headerStreak) headerStreak.textContent = streak;
  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  set('header-mult', '\u00d7' + streakMultiplier(streak).toFixed(2));
  set('header-best', records.score.score.toLocaleString());
  set('best-score-sub', records.score.score > 0 && records.score.streak !== null ? `streak ${records.score.streak.toLocaleString()}` : '');
  set('header-best-streak', records.streak.streak.toLocaleString());
  set('best-streak-sub', records.streak.streak > 0 && records.streak.score !== null ? `score ${records.streak.score.toLocaleString()}` : '');
  updateDepth();
}

function showStatus(text, type) {
  if (!statusMessage) return;
  statusMessage.classList.remove('quiet');
  statusMessage.dataset.type = type || 'info';
  statusMessage.textContent = text;
}

function shakeInput() {
  if (!playerInput) return;
  playerInput.classList.remove('bad');
  void playerInput.offsetWidth;
  playerInput.classList.add('bad');
  setTimeout(() => playerInput.classList.remove('bad'), 700);
}

/* ---------- endings ---------- */
function gameOver(reason) {
  disarmGiveUp();
  clearInterval(turnTimer);
  isGameActive = false;
  syncStrictLock();
  if (playerInput) { playerInput.disabled = true; playerInput.value = ''; }
  if (btnSubmit) btnSubmit.disabled = true;
  if (btnGiveUp) btnGiveUp.disabled = true;
  Stats.endGame(false, reason, streak, matchWords);
  const endStreak = streak;
  streak = 0;
  updateScoreboard();
  showStatus(`Game over. ${reason}`, "error");
  showGameOverSuggestions();
  syncBubbles(false);
  Results.later(false, reason, endStreak);
}

function showGameOverSuggestions() {
  if (!gameOverSuggestions || !requiredPrefix) return;

  const candidates = usableWords(requiredPrefix);   // already easiest first

  if (suggestionPrefixBadge) suggestionPrefixBadge.textContent = `${requiredPrefix.toUpperCase()} \u00b7 ${activeTailLength} letter${activeTailLength === 1 ? '' : 's'}`;
  if (suggestionWordsList) suggestionWordsList.innerHTML = '';

  if (candidates.length === 0) {
    if (suggestionWordsList) suggestionWordsList.innerHTML = '<div class="no-words">No valid words were left in the dictionary.</div>';
  } else {
    const total = candidates.length;
    const sampled = [];

    if (total <= 10) {
      sampled.push(...candidates);
    } else {
      for (let i = 0; i < 10; i++) {
        const index = Math.floor((i / 9) * (total - 1));
        sampled.push(candidates[index]);
      }
    }

    sampled.forEach((word, idx) => {
      const tier = idx < 3 ? 'easy' : idx >= 7 ? 'hard' : 'mid';
      const prefixPart = word.slice(0, requiredPrefix.length);
      const restPart = word.slice(requiredPrefix.length);

      const item = document.createElement('div');
      item.className = `sug ${tier}`;
      item.dataset.define = word;
      item.innerHTML = `<span class="n">${idx + 1}</span><span class="w"><b>${prefixPart}</b>${restPart}</span><span class="len">${word.length}</span>`;
      if (suggestionWordsList) suggestionWordsList.appendChild(item);
    });
  }

  gameOverSuggestions.classList.remove('hidden');
  if (window.innerWidth < 900) gameOverSuggestions.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function playerWins(reason) {
  disarmGiveUp();
  clearInterval(turnTimer);
  isGameActive = false;
  syncStrictLock();
  if (playerInput) { playerInput.disabled = true; playerInput.value = ''; }
  if (btnSubmit) btnSubmit.disabled = true;
  if (btnGiveUp) btnGiveUp.disabled = true;
  Stats.endGame(true, reason, streak, matchWords);
  score += 500;
  updateScoreboard();
  showStatus(`You win. ${reason}`, "success");
  syncBubbles(false);
  Results.later(true, reason, streak);
}

/* ---------- buttons ---------- */
let giveUpArmed = false;
let giveUpTimer = null;
function disarmGiveUp() {
  giveUpArmed = false;
  clearTimeout(giveUpTimer);
  if (btnGiveUp) btnGiveUp.textContent = 'Give up';
}
if (btnGiveUp) {
  // press twice: the first press asks, the second gives up. The timer keeps running the whole time.
  btnGiveUp.addEventListener('click', () => {
    if (!isGameActive) return;
    if (!giveUpArmed) {
      giveUpArmed = true;
      btnGiveUp.textContent = 'Sure?';
      giveUpTimer = setTimeout(disarmGiveUp, 3000);
    } else {
      disarmGiveUp();
      gameOver("You gave up.");
    }
  });
}
// the very first time Start is pressed, the rules pop-up opens first and "Got it, start" begins the match
const RULES_SEEN_KEY = 'wordchain-hint-seen';
let startAfterRules = false;
function rulesSeen() { try { return localStorage.getItem(RULES_SEEN_KEY) === '1'; } catch (e) { return true; } }
if (btnStart) btnStart.addEventListener('click', () => {
  if (!rulesSeen() && modalInstructions) { startAfterRules = true; if (btnModalOk) btnModalOk.textContent = 'Got it, start'; toggleModal(true); return; }
  startGame();
});

function toggleModal(show) {
  if (modalInstructions) modalInstructions.classList.toggle('hidden', !show);
  if (!show) {
    if (btnModalOk) btnModalOk.textContent = 'Got it';
    if (startAfterRules) { try { localStorage.setItem(RULES_SEEN_KEY, '1'); } catch (e) { /* ignore */ } }
  }
}
if (btnHowToPlay) btnHowToPlay.addEventListener('click', () => toggleModal(true));
if (btnCloseModal) btnCloseModal.addEventListener('click', () => { toggleModal(false); startAfterRules = false; });
if (btnModalOk) btnModalOk.addEventListener('click', () => {
  const go = startAfterRules;
  toggleModal(false);
  startAfterRules = false;
  if (go) startGame();
});
if (modalInstructions) {
  modalInstructions.addEventListener('click', (e) => { if (e.target === modalInstructions) { toggleModal(false); startAfterRules = false; } });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { toggleModal(false); startAfterRules = false; } });

/* ---------- ocean sound: generated live in the browser, nothing to download ---------- */
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const OCEAN_LAYERS = ['water', 'pads', 'chimes', 'drone', 'calls', 'bubbles', 'metal', 'dread'];
// pad chords (MIDI notes, four voices): sunlit = bright and open, twilight = softer and minor, deep = low stacked fifths
const OCEAN_CHORDS = [
  [[50, 57, 61, 66], [47, 54, 57, 62], [43, 50, 59, 66], [45, 52, 59, 64]],
  [[38, 45, 53, 60], [46, 53, 57, 62], [43, 50, 58, 65], [45, 50, 57, 64]],
  [[38, 45, 50, 57], [36, 43, 50, 55], [34, 41, 48, 53], [38, 45, 52, 59]]
];

function createOcean(ctx, dest, seed) {
  let s = (seed == null ? Math.floor(Math.random() * 4294967296) : seed) >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const now = () => ctx.currentTime;
  const ramp = (param, v, tc) => { if (tc > 0) param.setTargetAtTime(v, now(), tc); else param.setValueAtTime(v, now()); };
  let depth = 0;
  const starters = [];
  const osc = (type, freq) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; starters.push(o); return o; };
  const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q == null ? 0.7 : q; return b; };

  /* output: layers -> bus -> tone -> compressor -> master -> speakers */
  const master = gain(0);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 24; comp.ratio.value = 3; comp.attack.value = 0.08; comp.release.value = 0.5;
  const tone = filt('lowpass', 7000, 0.3);
  const bus = gain(1);
  bus.connect(tone); tone.connect(comp); comp.connect(master); master.connect(dest);

  /* a soft, dark reverb made from decaying noise */
  const secs = 4.5, len = Math.floor(ctx.sampleRate * secs);
  const imp = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = imp.getChannelData(c); let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.62 + (rnd() * 2 - 1) * 0.38; d[i] = last * Math.pow(1 - i / len, 3.2); }
  }
  const verb = ctx.createConvolver(); verb.buffer = imp;
  const verbIn = gain(1), verbOut = gain(0.8);
  verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(bus);

  /* each layer has its own level, plus how much of it goes into the reverb */
  const layer = {};
  const send = { water: 0.08, pads: 0.5, chimes: 0.7, drone: 0.1, calls: 0.9, bubbles: 0.25, metal: 0.85, dread: 0.8 };
  OCEAN_LAYERS.forEach((n) => { const g = gain(1); g.connect(bus); const sg = gain(send[n]); g.connect(sg); sg.connect(verbIn); layer[n] = g; });

  /* water: a slow dark wash plus a little surface shimmer that fades with depth */
  function brownNoise(sec) {
    const sr = ctx.sampleRate, N = Math.floor(sr * sec), F = Math.floor(sr * 0.25);
    const gen = new Float32Array(N + F); let last = 0;
    for (let i = 0; i < N + F; i++) { last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02; gen[i] = last * 3.5; }
    const buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = i < F ? gen[i] * (i / F) + gen[N + i] * (1 - i / F) : gen[i];
    return buf;
  }
  function whiteNoise(sec) {
    const sr = ctx.sampleRate, N = Math.floor(sr * sec), buf = ctx.createBuffer(1, N, sr), d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = rnd() * 2 - 1;
    return buf;
  }
  const wash = ctx.createBufferSource(); wash.buffer = brownNoise(8); wash.loop = true; starters.push(wash);
  const washHP = filt('highpass', 150, 0.5), washLP = filt('lowpass', 1500, 0.5), washDyn = gain(0.2);
  wash.connect(washHP); washHP.connect(washLP); washLP.connect(washDyn); washDyn.connect(layer.water);
  const swell = osc('sine', 0.09), swellAmt = gain(0.2); swell.connect(swellAmt); swellAmt.connect(washDyn.gain);
  const drift = osc('sine', 0.05), driftAmt = gain(350); drift.connect(driftAmt); driftAmt.connect(washLP.frequency);
  const fizz = ctx.createBufferSource(); fizz.buffer = whiteNoise(3); fizz.loop = true; starters.push(fizz);
  const fizzBP = filt('bandpass', 3200, 0.8), fizzDyn = gain(0.012);
  fizz.connect(fizzBP); fizzBP.connect(fizzDyn); fizzDyn.connect(layer.water);
  const fizzLfo = osc('sine', 0.13), fizzAmt = gain(0.008); fizzLfo.connect(fizzAmt); fizzAmt.connect(fizzDyn.gain);

  /* pads: four slow voices that glide from chord to chord */
  const padLP = filt('lowpass', 2600, 0.4), padDyn = gain(1);
  padLP.connect(padDyn); padDyn.connect(layer.pads);
  const voices = [];
  for (let i = 0; i < 4; i++) {
    const a = osc('triangle', 220), b = osc('sine', 220);
    a.detune.value = -5 + i * 3; b.detune.value = 5 - i * 2;
    const vg = gain(0.06), ga = gain(0.7), gb = gain(0.9);
    a.connect(ga); b.connect(gb); ga.connect(vg); gb.connect(vg); vg.connect(padLP);
    const breath = osc('sine', 0.03 + i * 0.012), breathAmt = gain(0.028); breath.connect(breathAmt); breathAmt.connect(vg.gain);
    voices.push({ a, b });
  }
  let chordIdx = 0, firstChord = true;
  function changeChord(t) {
    const z = depth < 0.28 ? 0 : depth < 0.62 ? 1 : 2, prog = OCEAN_CHORDS[z], chord = prog[chordIdx++ % prog.length];
    voices.forEach((v, i) => {
      const f = midiHz(chord[i]);
      if (firstChord) { v.a.frequency.setValueAtTime(f, t); v.b.frequency.setValueAtTime(f, t); }
      else { v.a.frequency.setTargetAtTime(f, t, 2.2); v.b.frequency.setTargetAtTime(f, t, 2.2); }
    });
    firstChord = false;
  }

  /* chimes: a few soft glassy notes near the surface that thin out and disappear */
  function playChime(t) {
    if (rnd() > 1 - smoothstep(0.25, 0.7, depth)) return;
    const scale = depth < 0.3 ? [74, 76, 78, 81, 83, 86] : [62, 67, 69, 74];
    const f = midiHz(scale[Math.floor(rnd() * scale.length)]);
    const g = gain(0.0001), pan = ctx.createStereoPanner();
    pan.pan.value = rnd() * 1.2 - 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * (0.6 + rnd() * 0.4), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    [[1, 1], [2, 0.2], [3.01, 0.06]].forEach(([r, amt]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
      const pg = gain(amt); o.connect(pg); pg.connect(g); o.start(t); o.stop(t + 3.8);
    });
    g.connect(pan); pan.connect(layer.chimes);
  }

  /* drone: a very low hum that only appears further down */
  const droneLP = filt('lowpass', 240, 0.5), droneDyn = gain(0);
  const dr1 = osc('sine', 36.71), dr2 = osc('triangle', 73.42), dr3 = osc('sine', 55);
  dr3.detune.value = 3;
  const g1 = gain(0.9), g2 = gain(0.35), g3 = gain(0.3);
  dr1.connect(g1); dr2.connect(g2); dr3.connect(g3); g1.connect(droneLP); g2.connect(droneLP); g3.connect(droneLP);
  droneLP.connect(droneDyn); droneDyn.connect(layer.drone);
  const trem = osc('sine', 0.06), tremAmt = gain(0.05); trem.connect(tremAmt); tremAmt.connect(droneDyn.gain);
  // a second hum a half step above the first, so the abyss beats and feels uneasy
  const dr4 = osc('sine', 38.9), g4 = gain(0); dr4.connect(g4); g4.connect(droneLP);

  /* calls: far-off, whale-like swells that only start past the twilight */
  function playCall(t) {
    if (rnd() > smoothstep(0.4, 0.75, depth)) return;
    const f0 = 140 + rnd() * 70, dur = 4.5 + rnd() * 3;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + dur * 0.35);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + dur);
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    o2.frequency.setValueAtTime(f0 * 2, t);
    o2.frequency.exponentialRampToValueAtTime(f0 * 3.2, t + dur * 0.35);
    o2.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + dur);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2;
    const vibAmt = gain(3); vib.connect(vibAmt); vibAmt.connect(o.frequency);
    const og2 = gain(0.22); o2.connect(og2);
    const g = gain(0.0001), lp = filt('lowpass', 900, 0.4), pan = ctx.createStereoPanner();
    pan.pan.value = rnd() * 1.6 - 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 1.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.2);
    o.connect(g); og2.connect(g); g.connect(lp); lp.connect(pan); pan.connect(layer.calls);
    [o, o2, vib].forEach((n) => { n.start(t); n.stop(t + dur + 2.4); });
  }

  /* bubbles: little bloops that rise past you, bigger and lower the deeper you are */
  function playBubbles(t) {
    if (rnd() > 0.4 + 0.6 * smoothstep(0.05, 0.5, depth)) return;
    const n = 2 + Math.floor(rnd() * 6), base = 560 - depth * 330;
    let tt = t;
    for (let i = 0; i < n; i++) {
      tt += 0.07 + rnd() * 0.24;
      const f = base * (0.6 + rnd() * 0.9), o = ctx.createOscillator(), g = gain(0.0001), pan = ctx.createStereoPanner();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 2.2, tt + 0.09);
      g.gain.setValueAtTime(0.0001, tt);
      g.gain.exponentialRampToValueAtTime(0.2 * (0.5 + rnd() * 0.5), tt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.15);
      pan.pan.value = rnd() * 1.4 - 0.7;
      o.connect(g); g.connect(pan); pan.connect(layer.bubbles);
      o.start(tt); o.stop(tt + 0.17);
    }
  }

  /* metal: a huge structure groaning in the dark (stick and slip), now and then a far-off clang */
  function playCreak(t) {
    if (rnd() > smoothstep(0.55, 0.9, depth)) return;
    const dur = 2.5 + rnd() * 3.5, f0 = 46 + rnd() * 40, pts = 60;
    const o = ctx.createOscillator(), sq = ctx.createOscillator();
    o.type = 'sawtooth'; sq.type = 'sine';
    const c1 = new Float32Array(pts), c2 = new Float32Array(pts);
    let step = 0, drift = (rnd() < 0.5 ? 1 : -1) * (0.08 + rnd() * 0.16);
    for (let i = 0; i < pts; i++) {
      if (i % 3 === 0) step = (rnd() - 0.5) * 0.22;
      c1[i] = f0 * (1 + step + drift * (i / pts));
      c2[i] = (700 + rnd() * 500) * (1 + step * 0.6);
    }
    o.frequency.setValueCurveAtTime(c1, t, dur); sq.frequency.setValueCurveAtTime(c2, t, dur);
    const bp = filt('bandpass', 380 + rnd() * 200, 9), lp = filt('lowpass', 1800, 0.5);
    bp.frequency.setValueAtTime(bp.frequency.value, t);
    bp.frequency.linearRampToValueAtTime(650 + rnd() * 500, t + dur);
    const g = gain(0.0001), sg = gain(0.04), pan = ctx.createStereoPanner();
    pan.pan.value = rnd() * 1.6 - 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
    o.connect(bp); bp.connect(g); sq.connect(sg); sg.connect(g); g.connect(lp); lp.connect(pan); pan.connect(layer.metal);
    [o, sq].forEach((n) => { n.start(t); n.stop(t + dur + 1.4); });
  }
  function playClang(t) {
    if (rnd() > 0.8 * smoothstep(0.78, 0.95, depth)) return;
    const f = 70 + rnd() * 50, pan = ctx.createStereoPanner(), lp = filt('lowpass', 1100, 0.5);
    pan.pan.value = rnd() * 1.6 - 0.8;
    [[1, 1, 5.5], [2.32, 0.6, 4], [3.87, 0.35, 3], [5.4, 0.18, 2]].forEach(([r, amt, ring]) => {
      const o = ctx.createOscillator(), g = gain(0.0001);
      o.type = 'sine'; o.frequency.value = f * r;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22 * amt, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + ring + 0.1);
    });
    lp.connect(pan); pan.connect(layer.metal);
  }

  /* dread: slow clusters of low notes a half step apart, swelling out of nowhere */
  function playDread(t) {
    if (rnd() > smoothstep(0.45, 0.85, depth)) return;
    const dur = 7 + rnd() * 5, f = 52 + rnd() * 30;
    const g = gain(0.0001), lp = filt('lowpass', 420, 0.5), pan = ctx.createStereoPanner();
    pan.pan.value = rnd() * 1.2 - 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[1, 1], [1.0595, 0.8], [1.4142, 0.5], [2.1189, 0.25]].forEach(([r, amt]) => {
      const o = ctx.createOscillator(), og = gain(amt);
      o.type = 'sine';
      o.frequency.setValueAtTime(f * r, t);
      o.frequency.exponentialRampToValueAtTime(f * r * 0.93, t + dur);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.1);
    });
    g.connect(lp); lp.connect(pan); pan.connect(layer.dread);
  }


  /* scheduler: queues events a few seconds ahead of the clock */
  let nextChord = 0, nextChime = 0, nextCall = 0, nextBubble = 0, nextCreak = 0, nextDread = 0;
  function schedule(until) {
    while (nextChord < until) { changeChord(Math.max(nextChord, now())); nextChord += 16 + rnd() * 7; }
    while (nextChime < until) { playChime(nextChime); nextChime += (2.4 + rnd() * 3.6) * (1 + depth * 1.5); }
    while (nextCall < until) { playCall(nextCall); nextCall += 18 + rnd() * 20; }
    while (nextBubble < until) { playBubbles(nextBubble); nextBubble += 3.5 + rnd() * 8; }
    while (nextCreak < until) { playCreak(nextCreak); playClang(nextCreak + 4 + rnd() * 8); nextCreak += 13 + rnd() * 20; }
    while (nextDread < until) { playDread(nextDread); nextDread += 22 + rnd() * 26; }
  }

  return {
    begin() {
      const t = now(); nextChord = t; nextChime = t + 2; nextCall = t + 9 + rnd() * 9; nextBubble = t + 3; nextCreak = t + 8 + rnd() * 8; nextDread = t + 12 + rnd() * 10;
      starters.forEach((n) => n.start(t));
    },
    schedule,
    setMaster(v, tc) { ramp(master.gain, v, tc); },
    setLevel(name, v, tc) { if (layer[name]) ramp(layer[name].gain, v, tc); },
    setDepth(d, tc) {
      depth = Math.min(1, Math.max(0, d));
      const k = depth, wb = 1500 * Math.pow(380 / 1500, k), wg = 0.2 - 0.06 * k, fz = 0.012 * (1 - smoothstep(0, 0.45, k)), dg = 0.1 * smoothstep(0.15, 0.85, k);
      ramp(tone.frequency, 7000 * Math.pow(1100 / 7000, k), tc);
      ramp(washLP.frequency, wb, tc); ramp(driftAmt.gain, wb * 0.23, tc);
      ramp(washDyn.gain, wg, tc); ramp(swellAmt.gain, wg * 0.4, tc);
      ramp(fizzDyn.gain, fz, tc); ramp(fizzAmt.gain, fz * 0.4, tc);
      ramp(padLP.frequency, 2600 * Math.pow(520 / 2600, k), tc);
      ramp(padDyn.gain, 1 - 0.3 * k, tc);
      ramp(droneDyn.gain, dg, tc); ramp(tremAmt.gain, dg * 0.25, tc);
      ramp(g4.gain, 0.9 * smoothstep(0.8, 1, k), tc);
    }
  };
}

/* ---------- settings (kept in this browser) ---------- */
// put your Ko-fi page here, for example 'https://ko-fi.com/yourname'. While it is empty the support box stays hidden.
const KOFI_URL = 'https://ko-fi.com/samyfiorini';
const SETTINGS_KEY = 'wordchain-settings';
const DEFAULT_SETTINGS = { music: false, volume: 60, layers: { water: 80, pads: 80, chimes: 80, drone: 80, calls: 80, bubbles: 80, metal: 80, dread: 80 }, follow: true, preview: 0, results: true, minStreak: 0, minScore: 0 };
const clampNum = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
function loadSettings() {
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      if (typeof raw.music === 'boolean') s.music = raw.music;
      if (typeof raw.follow === 'boolean') s.follow = raw.follow;
      if (typeof raw.results === 'boolean') s.results = raw.results;
      if (Number.isFinite(raw.minStreak) && raw.minStreak >= 0) s.minStreak = Math.min(9999, Math.floor(raw.minStreak));
      if (Number.isFinite(raw.minScore) && raw.minScore >= 0) s.minScore = Math.min(9999999, Math.floor(raw.minScore));
      if (records.streak.streak < 250) s.follow = true;
      s.volume = clampNum(raw.volume, 0, 100, s.volume);
      s.preview = clampNum(raw.preview, 0, 250, s.preview);
      OCEAN_LAYERS.forEach((n) => { s.layers[n] = clampNum(raw.layers && raw.layers[n], 0, 100, s.layers[n]); });
    }
  } catch (e) { /* storage unavailable: defaults */ }
  return s;
}
let settings = loadSettings();
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } }

/* ---------- depth: the streak decides how deep the water is (deepest at 250) ---------- */
const DEEPEST_STREAK = 250;
const ZONES = [[0.2, 'sunlit'], [0.5, 'twilight'], [0.85, 'midnight'], [1.01, 'abyss']];
const seaMid = document.getElementById('sea-mid');
const seaDeep = document.getElementById('sea-deep');
const lightEl = document.querySelector('.light');
const seaStruct = document.getElementById('sea-structure');
const depthReadout = document.getElementById('depth-readout');
const depthUnlocked = () => records.streak.streak >= DEEPEST_STREAK;
const followingStreak = () => settings.follow || !depthUnlocked();
function currentDepth() {
  const s = followingStreak() ? streak : settings.preview;
  return Math.min(1, Math.max(0, s / DEEPEST_STREAK));
}
function updateDepth() {
  const d = currentDepth();
  visualDepth = d;
  if (seaMid) seaMid.style.opacity = smoothstep(0.05, 0.5, d).toFixed(3);
  if (seaDeep) seaDeep.style.opacity = smoothstep(0.4, 0.95, d).toFixed(3);
  if (seaStruct) seaStruct.style.opacity = (0.34 * smoothstep(0.78, 0.98, d)).toFixed(3);
  if (lightEl) lightEl.style.opacity = (1 - 0.95 * smoothstep(0.02, 0.55, d)).toFixed(3);
  if (depthReadout) {
    const zone = ZONES.find((z) => d < z[0])[1];
    depthReadout.textContent = Math.round(d * 4000).toLocaleString() + ' m';
    depthReadout.dataset.zone = zone;
    depthReadout.title = 'You are in the ' + zone + ' zone. Depth follows your streak.';
  }
  Ocean.setDepth(d);
  syncDepthUI();
}

/* ---------- sound controller ---------- */
const Ocean = (() => {
  let ctx = null, eng = null, timer = null, playing = false, want = false;
  const volGain = (v) => Math.pow(v / 100, 1.6);
  const lvlGain = (v) => Math.pow(v / 80, 2);
  function applyLevels(tc) { OCEAN_LAYERS.forEach((n) => eng.setLevel(n, lvlGain(settings.layers[n]), tc)); }
  async function start() {
    want = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      if (!ctx) {
        ctx = new AC();
        eng = createOcean(ctx, ctx.destination);
        applyLevels(0); eng.setDepth(currentDepth(), 0); eng.begin();
      }
      await ctx.resume();
    } catch (e) { want = false; return false; }
    if (!want) return false;
    eng.setMaster(volGain(settings.volume), 1.0);
    eng.schedule(ctx.currentTime + 4);
    if (!timer) timer = setInterval(() => { if (playing) eng.schedule(ctx.currentTime + 4); }, 700);
    playing = true;
    return true;
  }
  function stop() {
    want = false;
    if (!eng || !playing) return;
    playing = false;
    eng.setMaster(0, 0.25);
    setTimeout(() => { if (!want && ctx && ctx.state === 'running') ctx.suspend(); }, 1600);
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !playing) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
  return {
    start, stop,
    isOn: () => playing,
    setDepth(d) { if (eng) eng.setDepth(d, 1.5); },
    setVolume() { if (eng && playing) eng.setMaster(volGain(settings.volume), 0.15); },
    setLayer(n) { if (eng) eng.setLevel(n, lvlGain(settings.layers[n]), 0.15); }
  };
})();

/* ---------- settings menu ---------- */
const modalSettings = document.getElementById('modal-settings');
const setMusic = document.getElementById('set-music');
const setVolume = document.getElementById('set-volume');
const setFollow = document.getElementById('set-follow');
const setResults = document.getElementById('set-results');
const setMinStreak = document.getElementById('set-min-streak');
const setMinScore = document.getElementById('set-min-score');
const setPreview = document.getElementById('set-preview');
const soundNote = document.getElementById('sound-note');
const depthHint = document.getElementById('depth-hint');
function paintRange(r) {
  const out = document.getElementById('out-' + r.id.replace('set-', ''));
  r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  if (out) out.textContent = r.value;
}
function syncDepthUI() {
  if (!setPreview) return;
  const unlocked = depthUnlocked(), following = followingStreak();
  setFollow.checked = following;
  setFollow.disabled = !unlocked;
  setFollow.closest('.toggle').classList.toggle('is-disabled', !unlocked);
  if (depthHint) depthHint.textContent = unlocked
    ? 'Turn this off to explore any depth, from the surface at 0 to the abyss at 250. The water and the sound both change as you move the slider.'
    : 'Reach a streak of 250 once to unlock exploring other depths. Your best so far is ' + records.streak.streak + '.';
  setPreview.disabled = following;
  setPreview.value = following ? Math.min(DEEPEST_STREAK, streak) : settings.preview;
  paintRange(setPreview);
}
function syncSettingsUI() {
  if (!setMusic) return;
  setMusic.checked = settings.music;
  setResults.checked = settings.results;
  setMinStreak.value = settings.minStreak;
  setMinScore.value = settings.minScore;
  setVolume.value = settings.volume; paintRange(setVolume);
  OCEAN_LAYERS.forEach((n) => { const r = document.getElementById('set-' + n); r.value = settings.layers[n]; paintRange(r); });
  syncDepthUI();
}
(function showSupport() {
  const box = document.getElementById('support'), a = document.getElementById('kofi-link');
  if (!box || !a || !/^https:\/\/ko-fi\.com\/[\w-]+\/?$/i.test(KOFI_URL)) return;
  a.href = KOFI_URL;
  box.classList.remove('hidden');
})();

function toggleSettings(show) {
  if (!modalSettings) return;
  modalSettings.classList.toggle('hidden', !show);
  if (show) syncSettingsUI();
}
if (setMusic) {
  setMusic.addEventListener('change', async () => {
    settings.music = setMusic.checked; saveSettings();
    if (soundNote) soundNote.textContent = '';
    if (settings.music) {
      const ok = await Ocean.start();
      if (!ok) {
        settings.music = false; setMusic.checked = false; saveSettings();
        if (soundNote) soundNote.textContent = 'Sound could not start in this browser.';
      }
    } else Ocean.stop();
  });
  setVolume.addEventListener('input', () => { settings.volume = +setVolume.value; paintRange(setVolume); saveSettings(); Ocean.setVolume(); });
  OCEAN_LAYERS.forEach((n) => {
    const r = document.getElementById('set-' + n);
    r.addEventListener('input', () => { settings.layers[n] = +r.value; paintRange(r); saveSettings(); Ocean.setLayer(n); });
  });
  setResults.addEventListener('change', () => { settings.results = setResults.checked; saveSettings(); });
  const readNum = (el, max) => { const v = Math.floor(Number(el.value)); return Number.isFinite(v) && v > 0 ? Math.min(max, v) : 0; };
  setMinStreak.addEventListener('change', () => { settings.minStreak = readNum(setMinStreak, 9999); setMinStreak.value = settings.minStreak; saveSettings(); });
  setMinScore.addEventListener('change', () => { settings.minScore = readNum(setMinScore, 9999999); setMinScore.value = settings.minScore; saveSettings(); });
  setFollow.addEventListener('change', () => {
    if (!depthUnlocked()) { syncDepthUI(); return; }
    settings.follow = setFollow.checked;
    if (!settings.follow) settings.preview = Math.min(DEEPEST_STREAK, streak);
    saveSettings(); updateDepth();
  });
  // while you drag the depth slider the menu backdrop clears and the water changes quickly, so you can watch it happen
  let peekTimer = null;
  const peek = () => {
    document.body.classList.add('previewing'); modalSettings.classList.add('peek');
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { modalSettings.classList.remove('peek'); document.body.classList.remove('previewing'); }, 1800);
  };
  setPreview.addEventListener('input', () => { settings.preview = +setPreview.value; saveSettings(); peek(); updateDepth(); });
  document.getElementById('btn-settings').addEventListener('click', () => toggleSettings(true));
  document.getElementById('btn-close-settings').addEventListener('click', () => toggleSettings(false));
  document.getElementById('btn-settings-ok').addEventListener('click', () => toggleSettings(false));
  modalSettings.addEventListener('click', (e) => { if (e.target === modalSettings) toggleSettings(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleSettings(false); });
  // browsers only allow sound after a click or key press, so a saved "on" starts at the first one
  if (settings.music) {
    const arm = () => {
      document.removeEventListener('pointerdown', arm); document.removeEventListener('keydown', arm);
      if (settings.music) Ocean.start();
    };
    document.addEventListener('pointerdown', arm); document.addEventListener('keydown', arm);
  }
  syncSettingsUI();
}

/* ---------- stats (kept in this browser) ---------- */
const STATS_KEY = 'wordchain-stats';
const LEN_BUCKETS = ['2-4', '5-6', '7-8', '9-10', '11+'];
const MILESTONES = [10, 25, 50, 100, 150, 250];
const lenBucket = (n) => (n <= 4 ? '2-4' : n <= 6 ? '5-6' : n <= 8 ? '7-8' : n <= 10 ? '9-10' : '11+');
function freshStats() {
  return {
    games: 0, wins: 0, causes: { gaveUp: 0, timeout: 0, guesses: 0, gemTime: 0, gemStuck: 0 },
    words: 0, letters: 0, totalScore: 0, playMs: 0, badGuesses: 0, onlineWords: 0, lookups: 0,
    longest: { word: '', len: 0 }, bestWord: { word: '', points: 0 },
    answerSecs: 0, answers: 0, fastest: null, streakSum: 0, longestGame: 0, lastPlayed: 0,
    tails: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    lens: { '2-4': 0, '5-6': 0, '7-8': 0, '9-10': 0, '11+': 0 },
    milestones: { 10: 0, 25: 0, 50: 0, 100: 0, 150: 0, 250: 0 },
    byGem: { broken: { games: 0, best: 0 }, impure: { games: 0, best: 0 }, perfect: { games: 0, best: 0 } }
  };
}
const Stats = (() => {
  const num = (v) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
  let data = freshStats();
  let startedAt = 0;
  function load() {
    data = freshStats();
    try {
      const raw = JSON.parse(localStorage.getItem(STATS_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return;
      const merge = (dst, src) => {
        if (!src || typeof src !== 'object') return;
        Object.keys(dst).forEach((k) => {
          if (typeof dst[k] === 'number') dst[k] = num(src[k]);
          else if (dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], src[k]);
          else if (typeof dst[k] === 'string' && typeof src[k] === 'string') dst[k] = src[k].slice(0, 60);
        });
      };
      merge(data, raw);
      data.fastest = typeof raw.fastest === 'number' && raw.fastest >= 0 ? raw.fastest : null;
    } catch (e) { /* defaults */ }
  }
  function save() { try { localStorage.setItem(STATS_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }
  load();
  return {
    get: () => data,
    reload: load,
    reset() { data = freshStats(); startedAt = 0; },
    startGame() { startedAt = Date.now(); },
    bump(k) { data[k]++; save(); },
    word(word, points, tail, secs) {
      data.words++; data.letters += word.length; data.tails[tail] = (data.tails[tail] || 0) + 1;
      data.lens[lenBucket(word.length)]++;
      if (word.length > data.longest.len) data.longest = { word, len: word.length };
      if (points > data.bestWord.points) data.bestWord = { word, points };
      data.totalScore += points;
      data.answerSecs += secs; data.answers++;
      if (data.fastest === null || secs < data.fastest) data.fastest = secs;
      save();
    },
    endGame(won, reason, finalStreak, wordsThisGame) {
      data.games++;
      if (won) data.wins++;
      const c = /gave up/i.test(reason) ? 'gaveUp' : /Time ran out/i.test(reason) ? 'timeout' : /guesses/i.test(reason) ? 'guesses' : /gem ran out/i.test(reason) ? 'gemTime' : 'gemStuck';
      data.causes[c]++;
      if (won) data.totalScore += 500;
      data.streakSum += finalStreak;
      MILESTONES.forEach((m) => { if (finalStreak >= m) data.milestones[m]++; });
      data.longestGame = Math.max(data.longestGame, wordsThisGame);
      if (startedAt) data.playMs += Date.now() - startedAt;
      startedAt = 0;
      data.lastPlayed = Date.now();
      const d = data.byGem[typeOfGem];
      if (d) { d.games++; d.best = Math.max(d.best, finalStreak); }
      save();
    }
  };
})();

const modalStats = document.getElementById('modal-stats');
const statsBody = document.getElementById('stats-body');
function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return ms >= 1000 ? Math.round(ms / 1000) + ' s' : '0 min';
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}
function renderStats() {
  if (!statsBody) return;
  const d = Stats.get(), n = (v) => Math.round(v).toLocaleString();
  const avg = (a, b, dig) => (b > 0 ? (a / b).toFixed(dig == null ? 1 : dig) : 'none yet');
  const row = (k, v, sub) => `<div class="st-row"><span>${k}</span><b>${v}${sub ? `<small>${sub}</small>` : ''}</b></div>`;
  const group = (title, rows) => `<section class="st-group"><h4>${title}</h4>${rows.join('')}</section>`;
  const deepM = Math.round(Math.min(1, records.streak.streak / DEEPEST_STREAK) * 4000);
  const maxLen = Math.max(1, ...LEN_BUCKETS.map((b) => d.lens[b]));
  const bars = LEN_BUCKETS.map((b) => `<div class="st-bar"><span>${b}</span><i style="--w:${(d.lens[b] / maxLen * 100).toFixed(1)}%"></i><em>${n(d.lens[b])}</em></div>`).join('');
    const groups = [
    group('Records', [
      row('best score', n(records.score.score), records.score.streak !== null && records.score.score ? `streak ${n(records.score.streak)}` : ''),
      row('best streak', n(records.streak.streak), records.streak.score !== null && records.streak.streak ? `score ${n(records.streak.score)}` : ''),
      row('deepest you have been', n(deepM) + ' m'),
      row('highest scoring word', d.bestWord.word ? d.bestWord.word.toUpperCase() : 'none yet', d.bestWord.word ? n(d.bestWord.points) + ' points' : ''),
      row('longest word', d.longest.word ? d.longest.word.toUpperCase() : 'none yet', d.longest.word ? d.longest.len + ' letters' : ''),
      row('fastest answer', d.fastest === null ? 'none yet' : d.fastest + ' s'),
      row('longest match', n(d.longestGame) + ' of your words')
    ]),
    group('Overall', [
      row('matches played', n(d.games)),
      row('matches won', n(d.wins), d.games ? Math.round(d.wins / d.games * 100) + '%' : ''),
      row('time played', fmtDuration(d.playMs)),
      row('words you played', n(d.words)),
      row('letters typed', n(d.letters)),
      row('points earned', n(d.totalScore)),
      row('average score per match', d.games ? n(d.totalScore / d.games) : 'none yet'),
      row('average streak', avg(d.streakSum, d.games)),
      row('average word length', avg(d.letters, d.words), d.words ? 'letters' : ''),
      row('average answer time', avg(d.answerSecs, d.answers), d.answers ? 'seconds' : '')
    ]),
    group('Word lengths', [`<div class="st-bars">${bars}</div>`]),
    group('Matching letters', [`<div class="st-miles">${[1, 2, 3, 4, 5, 6].map((k) => `<div><span>${k} letter${k > 1 ? 's' : ''}</span><b>${n(d.tails[k])}</b></div>`).join('')}</div>`]),
    group('How matches ended', [
      row('you gave up', n(d.causes.gaveUp)), row('your time ran out', n(d.causes.timeout)),
      row('out of guesses', n(d.causes.guesses)), row('the gem ran out of time', n(d.causes.gemTime)),
      row('the gem had no word', n(d.causes.gemStuck))
    ]),
    group('Guesses', [
      row('words that were not in the dictionary', n(d.badGuesses)),
      row('words found by online lookup', n(d.onlineWords)),
      row('words you looked up', n(d.lookups))
    ]),
    group('Streak milestones', [`<div class="st-miles">${MILESTONES.map((m) => `<div><span>${m}</span><b>${n(d.milestones[m])}&times;</b></div>`).join('')}</div>`]),
    group('By type of gem', ['broken', 'impure', 'perfect'].map((k) => row(GEM_NAME[k], n(d.byGem[k].games) + ' matches', 'best streak ' + n(d.byGem[k].best)))),
  ];
  const last = d.lastPlayed ? `<p class="hint">Last played ${new Date(d.lastPlayed).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}.</p>` : '';
  const col = (...i) => `<div class="st-col">${i.map((k) => groups[k]).join('')}</div>`;
  statsBody.innerHTML = col(0, 4) + col(1, 5) + `<div class="st-col">${groups[2]}${groups[3]}${groups[6]}${groups[7]}${last}</div>`;
}
function toggleStats(show) {
  if (!modalStats) return;
  modalStats.classList.toggle('hidden', !show);
  if (show) { disarmErase(); renderStats(); const s = modalStats.querySelector('.sheet'); if (s) s.scrollTop = 0; }
}
const btnErase = document.getElementById('btn-erase');
let eraseArmed = false, eraseTimer = null;
function disarmErase() { eraseArmed = false; clearTimeout(eraseTimer); if (btnErase) btnErase.textContent = 'Erase all saved data'; }
function eraseAll() {
  ['wordchain-records', 'wordchain-best', STATS_KEY, SETTINGS_KEY, RULES_SEEN_KEY].forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
  records = { score: { score: 0, streak: null }, streak: { streak: 0, score: null } };
  Stats.reset();
  Ocean.stop();
  settings = loadSettings();
  syncSettingsUI();
  updateScoreboard();
  renderStats();
}
if (modalStats) {
  document.getElementById('btn-stats').addEventListener('click', () => toggleStats(true));
  document.getElementById('btn-close-stats').addEventListener('click', () => toggleStats(false));
  document.getElementById('btn-stats-ok').addEventListener('click', () => toggleStats(false));
  modalStats.addEventListener('click', (e) => { if (e.target === modalStats) toggleStats(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleStats(false); });
  btnErase.addEventListener('click', () => {
    if (!eraseArmed) {
      eraseArmed = true;
      btnErase.textContent = 'Press again to erase everything';
      eraseTimer = setTimeout(disarmErase, 4000);
    } else {
      disarmErase();
      eraseAll();
      const note = document.getElementById('erase-note');
      if (note) note.textContent = 'All saved data was erased.';
    }
  });
}

/* ---------- results screen ---------- */
const Results = (() => {
  const modal = document.getElementById('modal-results');
  const body = document.getElementById('res-body');
  const n = (v) => Math.round(v).toLocaleString();
  const secs = (v) => (v < 10 ? v.toFixed(1) : Math.round(v)) + ' s';
  let timer = null;
  function open(show) {
    if (!modal) return;
    modal.classList.toggle('hidden', !show);
    if (show) { const s = modal.querySelector('.sheet'); if (s) s.scrollTop = 0; }
  }
  function render(won, reason, endStreak) {
    const m = matchStart || { rec: records, longest: 0, best: 0, fastest: null, at: Date.now(), gem: typeOfGem };
    const log = matchLog;
    const letters = log.reduce((a, w) => a + w.word.length, 0);
    const avg = log.length ? log.reduce((a, w) => a + w.secs, 0) / log.length : 0;
    const fast = log.length ? Math.min(...log.map((w) => w.secs)) : null;
    const longest = log.reduce((a, w) => (w.word.length > a.word.length ? w : a), { word: '' });
    const bestW = log.reduce((a, w) => (w.points > a.points ? w : a), { points: 0, word: '' });
    const tails = [0, 0, 0, 0, 0, 0, 0];
    log.forEach((w) => { tails[Math.min(6, w.tail)]++; });
    const frac = Math.min(1, endStreak / DEEPEST_STREAK);
    const meters = Math.round(frac * 4000);
    const zone = (ZONES.find((z) => frac < z[0]) || ZONES[ZONES.length - 1])[1];
    const phase = Math.min(PHASES.length - 1, Math.floor(endStreak / 50));
    const badges = [];
    if (score > m.rec.score.score && score > 0) badges.push('new best score');
    if (endStreak > m.rec.streak.streak && endStreak > 0) badges.push('new best streak');
    if (longest.word && longest.word.length > m.longest) badges.push('longest word yet');
    if (bestW.points > m.best) badges.push('highest scoring word yet');
    if (fast !== null && (m.fastest === null || fast < m.fastest)) badges.push('fastest answer yet');
    if (won) badges.unshift('you beat the gem');
    const row = (k, v) => `<div class="st-row"><span>${k}</span><b>${v}</b></div>`;
    const group = (t, rows) => `<section class="st-group"><h4>${t}</h4>${rows.join('')}</section>`;
    const top = [...log].sort((a, b) => b.points - a.points).slice(0, 6);
    const chips = top.length ? `<div class="res-words">${top.map((w) => `<button type="button" class="res-word" data-define="${w.word}">${w.word}<small>${n(w.points)}</small></button>`).join('')}</div>` : '<p class="hint">No words this time.</p>';
    let missed = '';
    if (!won && requiredPrefix) {
      const c = usableWords(requiredPrefix), pick = [];
      if (c.length <= 8) pick.push(...c); else for (let i = 0; i < 8; i++) pick.push(c[Math.floor(i / 7 * (c.length - 1))]);
      missed = group('Words that would have worked <small>' + requiredPrefix.toUpperCase() + '</small>', [pick.length ? `<div class="res-words">${pick.map((w) => `<button type="button" class="res-word" data-define="${w}"><b>${w.slice(0, requiredPrefix.length)}</b>${w.slice(requiredPrefix.length)}</button>`).join('')}</div>` : '<p class="hint">No valid words were left.</p>']);
    }
    const miles = `<div class="st-miles">${[1, 2, 3, 4, 5, 6].map((k) => `<div><span>${k} letter${k > 1 ? 's' : ''}</span><b>${tails[k]}</b></div>`).join('')}</div>`;
    const gem = GEM_NAME[m.gem] || 'Broken';
    document.getElementById('res-title').textContent = won ? 'You won' : 'The chain ended';
    document.getElementById('res-reason').textContent = reason;
    body.innerHTML =
      `<div class="res-hero"><div class="res-big"><div><span>score</span><b>${n(score)}</b></div><div><span>streak</span><b>${n(endStreak)}</b></div></div>` +
      `<div class="res-badges">${badges.map((b) => `<span class="res-badge">${b}</span>`).join('')}</div>` +
      group('Your best words', [chips]) + `</div>` +
      `<div>${group('This match', [
        row('words you played', n(log.length)), row('letters typed', n(letters)),
        row('longest word', longest.word ? longest.word.toUpperCase() + ` <small>${longest.word.length} letters</small>` : 'none'),
        row('highest scoring word', bestW.word ? bestW.word.toUpperCase() + ` <small>${n(bestW.points)}</small>` : 'none'),
        ])}${group('Matching letters', [miles])}${missed}</div>` +
      `<div>${group('Pace', [
        row('average answer time', log.length ? secs(avg) : 'none'), row('fastest answer', fast === null ? 'none' : secs(fast)),
        row('time played', fmtDuration(Date.now() - m.at)), row('wrong guesses', n(matchBad))])}` +
      group('Where it ended', [row('gem', gem), row('depth reached', n(meters) + ' m <small>' + zone + '</small>'), row('phase reached', 'Phase ' + phase)]) + `</div>`;
    open(true);
  }
  return {
    later(won, reason, endStreak) {
      if (!settings.results || (!won && matchLog.length === 0)) return;
      // with a minimum set, only matches that reach the streak or the score get a results screen
      const anyMin = settings.minStreak > 0 || settings.minScore > 0;
      if (anyMin && !((settings.minStreak > 0 && endStreak >= settings.minStreak) || (settings.minScore > 0 && score >= settings.minScore))) return;
      clearTimeout(timer);
      timer = setTimeout(() => { if (!isGameActive) render(won, reason, endStreak); }, 900);
    },
    close() { clearTimeout(timer); open(false); },
    isOpen: () => modal && !modal.classList.contains('hidden')
  };
})();
(function wireResults() {
  const modal = document.getElementById('modal-results');
  if (!modal) return;
  document.getElementById('btn-close-results').addEventListener('click', Results.close);
  document.getElementById('btn-results-close').addEventListener('click', Results.close);
  document.getElementById('btn-results-again').addEventListener('click', () => { Results.close(); startGame(); });
  modal.addEventListener('click', (e) => { if (e.target === modal) Results.close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Results.close(); });
})();

/* ---------- word lookup (never during a match) ---------- */
const Define = (() => {
  const modal = document.getElementById('modal-define');
  const input = document.getElementById('define-input');
  const out = document.getElementById('define-result');
  const cache = new Map();
  const REST = 'https://en.wiktionary.org/api/rest_v1/page/definition/';
  const BACKUP = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
  const plain = (html) => {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll('ul, ol, dl, style, script, sup').forEach((el) => el.remove());
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  };
  // each source is turned into the same shape: [{ pos, defs: [{ text, example }] }]
  function fromWiktionary(data) {
    const list = data && Array.isArray(data.en) ? data.en : [];
    return list.map((p) => ({
      pos: String(p.partOfSpeech || '').toLowerCase(),
      defs: (p.definitions || []).map((d) => ({ text: plain(d.definition), example: plain((d.examples || [])[0]) })).filter((d) => d.text)
    })).filter((p) => p.defs.length);
  }
  function fromBackup(data) {
    if (!Array.isArray(data)) return [];
    const out = [];
    data.forEach((e) => (e.meanings || []).forEach((m) => {
      const defs = (m.definitions || []).map((d) => ({ text: plain(d.definition), example: plain(d.example) })).filter((d) => d.text);
      if (defs.length) out.push({ pos: String(m.partOfSpeech || '').toLowerCase(), defs });
    }));
    return out;
  }
  // returns { found: true, groups, source } | { found: false } | { error: true }
  async function fetchDefinition(word) {
    let reached = false;
    // Wiktionary is case sensitive: "spain" is not an entry but "Spain" is, so names are tried with a capital too
    for (const name of [word, word[0].toUpperCase() + word.slice(1)]) {
      try {
        const r = await fetch(REST + encodeURIComponent(name), { headers: { Accept: 'application/json' } });
        if (r.ok) { const g = fromWiktionary(await r.json()); reached = true; if (g.length) return { found: true, groups: g, source: 'Wiktionary', name }; }
        else if (r.status === 404) reached = true;
      } catch (e) { /* try the next one */ }
    }
    try {
      const r = await fetch(BACKUP + encodeURIComponent(word));
      if (r.ok) { const g = fromBackup(await r.json()); reached = true; if (g.length) return { found: true, groups: g, source: 'dictionaryapi.dev', name: word }; }
      else if (r.status === 404) reached = true;
    } catch (e) { /* offline */ }
    return reached ? { found: false } : { error: true };
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  function say(text) { out.replaceChildren(el('p', 'hint', text)); }
  function show(word, res) {
    const inGame = dictionarySet.has(word) && (!strictMode || strictSet.has(word));
    const head = el('div', 'def-word');
    head.append(el('span', '', res.name || word), el('span', 'def-tag' + (inGame ? ' yes' : ''), inGame ? 'valid in the game' : res.found ? 'accepted through online lookup' : 'not in the game list'));
    out.replaceChildren(head);
    if (!res.found) { out.append(el('p', 'hint', 'No definition was found for this word. Check the spelling, or try the base form (for example "walk" instead of "walked").')); return; }
    res.groups.forEach((g) => {
      out.append(el('div', 'def-pos', g.pos || 'word'));
      const ol = el('ol', 'def-list');
      g.defs.slice(0, 3).forEach((d) => { const li = el('li', '', d.text); if (d.example) li.append(el('em', '', '“' + d.example + '”')); ol.append(li); });
      out.append(ol);
    });
    const src = el('p', 'def-src', 'From ' + res.source);
    if (res.source === 'Wiktionary') {
      const a = el('a', '', 'open the full entry');
      a.href = 'https://en.wiktionary.org/wiki/' + encodeURIComponent(res.name || word); a.target = '_blank'; a.rel = 'noopener noreferrer';
      src.append(' · ', a);
    }
    out.append(src);
  }
  async function lookup(raw) {
    const word = String(raw || '').trim().toLowerCase();
    if (!/^[a-z]{1,40}$/.test(word)) { say('Please type a single word, letters only.'); return; }
    if (input) input.value = word;
    let res = cache.get(word);
    if (!res) {
      say('Looking up ' + word + '…');
      res = await fetchDefinition(word);
      if (res.error) { say('Could not reach the dictionary service. Check your connection and try again.'); return; }
      cache.set(word, res);
      Stats.bump('lookups');
    }
    if (!modal.classList.contains('hidden')) show(word, res);
  }
  function open(word) {
    if (isGameActive || !modal) return;
    modal.classList.remove('hidden');
    if (word) lookup(word);
    else if (input) { input.focus(); input.select(); }
  }
  function close() { if (modal) modal.classList.add('hidden'); }
  return { open, close, lookup, _fetch: fetchDefinition };
})();
(function wireDefine() {
  const modal = document.getElementById('modal-define');
  if (!modal) return;
  document.getElementById('btn-define').addEventListener('click', () => Define.open());
  document.getElementById('btn-close-define').addEventListener('click', Define.close);
  modal.addEventListener('click', (e) => { if (e.target === modal) Define.close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Define.close(); });
  document.getElementById('define-form').addEventListener('submit', (e) => { e.preventDefault(); Define.lookup(document.getElementById('define-input').value); });
  document.getElementById('define-random').addEventListener('click', () => {
    const pool = [...commonRank.keys()].filter((w) => w.length >= 5 && w.length <= 10 && commonRank.get(w) < 15000);
    Define.lookup(pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'lapis');
  });
  // words in the results screen and the "would have worked" list open here (the lookup refuses while a match is running)
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-define]');
    if (t) Define.open(t.dataset.define);
  });
})();

/* ---------- go ---------- */
updateScoreboard();
updateProbabilityUI();
updateTargetDisplay();
loadDictionary();
