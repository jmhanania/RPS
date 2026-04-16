// ============================================================
// Constants
// ============================================================
const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS   = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

const EPSILON_ADAPTIVE = 0.20;
const EPSILON_TRICKY   = 0.25;
const EPSILON_MARKOV   = 0.20;

const MIN_SUPPORT    = 3;
const MIN_MARGIN     = 0.40;
const PERSIST_WEIGHT = 0.50;

const defaultStats = () => ({
  totals: { rock: 0, paper: 0, scissors: 0 },
  order1: {
    rock:     { rock: 0, paper: 0, scissors: 0 },
    paper:    { rock: 0, paper: 0, scissors: 0 },
    scissors: { rock: 0, paper: 0, scissors: 0 },
  },
  order2: {},
});

const defaultConfig = () => ({ best_of: 5, difficulty: 4, debug: false });

// ============================================================
// Persistence (localStorage)
// ============================================================
const STATS_KEY  = 'rps_stats';
const CONFIG_KEY = 'rps_config';

const store = {
  stats:  { profiles: {} },
  config: { profiles: {}, last_profile: null },
};

function loadAll() {
  try {
    const s = localStorage.getItem(STATS_KEY);
    if (s) {
      const data = JSON.parse(s);
      store.stats = ('profiles' in data) ? data : { profiles: { Default: data } };
    }
  } catch (_) {}

  try {
    const c = localStorage.getItem(CONFIG_KEY);
    if (c) {
      const data = JSON.parse(c);
      if ('profiles' in data) {
        store.config = { profiles: {}, last_profile: null, ...data };
      } else {
        store.config = { profiles: { Default: data }, last_profile: 'Default' };
      }
    }
  } catch (_) {}
}

function saveAll() {
  try { localStorage.setItem(STATS_KEY,  JSON.stringify(store.stats));  } catch (_) {}
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(store.config)); } catch (_) {}
}

function ensureProfile(name) {
  if (!store.stats.profiles[name])  store.stats.profiles[name]  = defaultStats();
  if (!store.config.profiles[name]) store.config.profiles[name] = defaultConfig();
}

function profileNames() {
  const names = new Set([
    ...Object.keys(store.stats.profiles),
    ...Object.keys(store.config.profiles),
  ]);
  return [...names].sort();
}

// ============================================================
// AI
// ============================================================
function counterOf(move) {
  for (const [k, v] of Object.entries(BEATS)) {
    if (v === move) return k;
  }
}

function topWithSupport(counts) {
  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!items.length) return [null, 0, 0, 0];
  const [topMove, topCt] = items[0];
  const nextCt = items.length > 1 ? items[1][1] : 0;
  const total  = Object.values(counts).reduce((a, b) => a + b, 0);
  const margin = total > 0 ? (topCt - nextCt) / total : 0;
  return [topMove, topCt, nextCt, margin];
}

function recentWeightedPrediction(history, window) {
  window = window || 5;
  const weights = { rock: 0, paper: 0, scissors: 0 };
  for (const m of history)               weights[m] += 1;
  for (const m of history.slice(-window)) weights[m] += 1;
  const predicted = Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
  return [predicted, 'recent-weighted prediction: ' + predicted + ' (last ' + Math.min(window, history.length) + ' moves weighted).'];
}

function predictNextMoveMarkov(history, persistedStats) {
  const n = history.length;

  function combine(live, persist) {
    const out = { rock: 0, paper: 0, scissors: 0 };
    for (const m of CHOICES) out[m] = (live[m] || 0) + PERSIST_WEIGHT * (persist[m] || 0);
    return out;
  }

  if (n >= 3) {
    const [l0, l1] = history.slice(-2);
    const live2 = { rock: 0, paper: 0, scissors: 0 };
    for (let i = 0; i < n - 2; i++) {
      if (history[i] === l0 && history[i + 1] === l1) live2[history[i + 2]]++;
    }
    const saved2  = persistedStats.order2[l0 + ',' + l1] || { rock: 0, paper: 0, scissors: 0 };
    const counts2 = combine(live2, saved2);
    const [top, topCt,, margin] = topWithSupport(counts2);
    if (top && topCt >= MIN_SUPPORT && margin >= MIN_MARGIN) {
      return [top, 'Order-2 Markov (support=' + topCt.toFixed(0) + ', margin=' + margin.toFixed(2) + ') after [' + l0 + ', ' + l1 + '].'];
    }
  }

  if (n >= 2) {
    const last1 = history[n - 1];
    const live1 = { rock: 0, paper: 0, scissors: 0 };
    for (let i = 0; i < n - 1; i++) {
      if (history[i] === last1) live1[history[i + 1]]++;
    }
    const saved1  = persistedStats.order1[last1] || { rock: 0, paper: 0, scissors: 0 };
    const counts1 = combine(live1, saved1);
    const [top, topCt,, margin] = topWithSupport(counts1);
    if (top && topCt >= MIN_SUPPORT && margin >= MIN_MARGIN) {
      return [top, 'Order-1 Markov (support=' + topCt.toFixed(0) + ', margin=' + margin.toFixed(2) + ') after ' + last1 + '.'];
    }
  }

  return [null, 'No confident Markov pattern.'];
}

function getComputerChoice(difficulty, history, persistedStats) {
  const rand = () => CHOICES[Math.floor(Math.random() * CHOICES.length)];

  if (difficulty === 1 || !history.length) {
    return [rand(), 'Random pick.'];
  }

  if (difficulty === 2) {
    if (Math.random() < EPSILON_ADAPTIVE) return [rand(), (EPSILON_ADAPTIVE * 100) + '% unpredictability (Adaptive).'];
    const counts = { rock: 0, paper: 0, scissors: 0 };
    for (const m of history) counts[m]++;
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return [counterOf(mostCommon), 'Countering your most common move so far: ' + mostCommon + '.'];
  }

  if (difficulty === 3) {
    if (Math.random() < EPSILON_TRICKY) return [rand(), (EPSILON_TRICKY * 100) + '% unpredictability (Tricky).'];
    const [predicted, why] = recentWeightedPrediction(history);
    return [counterOf(predicted), "Predicting you'll throw " + predicted + ' (' + why + '); I picked its counter.'];
  }

  if (difficulty === 4) {
    if (Math.random() < EPSILON_MARKOV) return [rand(), (EPSILON_MARKOV * 100) + '% unpredictability (Markov).'];
    const [predicted, why] = predictNextMoveMarkov(history, persistedStats);
    if (predicted === null) {
      const [p2, why2] = recentWeightedPrediction(history);
      return [counterOf(p2), why + ' Falling back: ' + why2];
    }
    return [counterOf(predicted), why + ' I played its counter.'];
  }

  return [rand(), 'Fallback random.'];
}

// ============================================================
// App — UI + game logic
// ============================================================
const $    = id => document.getElementById(id);
const show = id => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
};

const EMOJI = { rock: '✊', paper: '🖐️', scissors: '✌️' };

const match = {
  player: null, history: [], roundHistory: [],
  playerScore: 0, computerScore: 0,
  bestOf: 5, winsNeeded: 3, difficulty: 4, debug: false,
  statsReturn: null,
};

function activeStats()  { return store.stats.profiles[match.player];  }
function activeConfig() { return store.config.profiles[match.player]; }

// ── Profile screen ──────────────────────────────────────────
function renderProfileScreen() {
  const list  = $('profile-list');
  list.innerHTML = '';
  const names = profileNames();
  if (!names.length) {
    const msg = document.createElement('p');
    msg.className   = 'empty-msg';
    msg.textContent = 'No profiles yet — create one below.';
    list.appendChild(msg);
  }
  for (const name of names) {
    const btn = document.createElement('button');
    btn.className = 'profile-btn';
    const last = store.config.last_profile === name;
    btn.innerHTML = '<span class="profile-icon">👤</span>'
      + '<span class="profile-name">' + name + '</span>'
      + (last ? '<span class="profile-badge">last played</span>' : '');
    btn.addEventListener('click', function() { enterProfile(name); });
    list.appendChild(btn);
  }
}

function enterProfile(name) {
  ensureProfile(name);
  match.player = name;
  store.config.last_profile = name;
  saveAll();
  renderSettingsScreen();
  show('screen-settings');
}

$('btn-create-profile').addEventListener('click', function() {
  const name = $('new-profile-name').value.trim();
  if (!name) return;
  $('new-profile-name').value = '';
  enterProfile(name);
});
$('new-profile-name').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') $('btn-create-profile').click();
});

// ── Settings screen ─────────────────────────────────────────
function renderSettingsScreen() {
  $('settings-profile-name').textContent = match.player;
  const cfg   = activeConfig();
  const boEl  = document.querySelector('input[name="best_of"][value="' + cfg.best_of + '"]');
  const dEl   = document.querySelector('input[name="difficulty"][value="' + cfg.difficulty + '"]');
  if (boEl) boEl.checked = true;
  if (dEl)  dEl.checked  = true;
  $('debug-toggle').checked = cfg.debug || false;
}

$('btn-settings-back').addEventListener('click', function() {
  renderProfileScreen();
  show('screen-profile');
});

$('btn-settings-play').addEventListener('click', function() {
  const cfg     = activeConfig();
  const boEl    = document.querySelector('input[name="best_of"]:checked');
  const dEl     = document.querySelector('input[name="difficulty"]:checked');
  if (boEl) cfg.best_of   = parseInt(boEl.value, 10);
  if (dEl)  cfg.difficulty = parseInt(dEl.value,  10);
  cfg.debug = $('debug-toggle').checked;
  saveAll();
  startMatch();
});

$('btn-settings-stats').addEventListener('click', function() {
  match.statsReturn = 'screen-settings';
  renderStatsScreen();
  show('screen-stats');
});

// ── Game screen ─────────────────────────────────────────────
function startMatch() {
  const cfg = activeConfig();
  match.bestOf        = cfg.best_of;
  match.difficulty    = cfg.difficulty;
  match.debug         = cfg.debug;
  // best_of === 0 means Infinite — winsNeeded is never reached
  match.winsNeeded    = cfg.best_of === 0 ? Infinity : Math.ceil(cfg.best_of / 2);
  match.history       = [];
  match.roundHistory  = [];
  match.playerScore   = 0;
  match.computerScore = 0;

  $('player-name-display').textContent  = match.player;
  $('match-label').textContent          = cfg.best_of === 0 ? 'Infinite' : 'Best of ' + match.bestOf;
  $('player-score').textContent         = '0';
  $('computer-score').textContent       = '0';
  $('result-area').className            = 'result-area idle';
  $('result-row').style.display         = 'none';
  $('idle-prompt').style.display        = 'block';
  $('round-history').innerHTML          = '';
  $('debug-info').style.display         = 'none';

  // Hide match-over panel, show choice buttons
  $('match-over-panel').style.display = 'none';
  $('choices-row').style.display      = '';
  $('round-history').style.display    = '';

  setChoicesDisabled(false);
  show('screen-game');
}

function setChoicesDisabled(disabled) {
  document.querySelectorAll('.choice-btn').forEach(function(btn) { btn.disabled = disabled; });
}

function playRound(playerMove) {
  setChoicesDisabled(true);

  const stats = activeStats();
  const result = getComputerChoice(match.difficulty, match.history, stats);
  const computerMove = result[0];
  const reason       = result[1];

  let outcome;
  if (playerMove === computerMove)             outcome = 'tie';
  else if (BEATS[playerMove] === computerMove) outcome = 'win';
  else                                          outcome = 'loss';

  if (outcome === 'win')  match.playerScore++;
  if (outcome === 'loss') match.computerScore++;

  const prev  = match.history.length >= 1 ? match.history[match.history.length - 1] : null;
  const prev2 = match.history.length >= 2 ? match.history[match.history.length - 2] : null;
  match.history.push(playerMove);
  match.roundHistory.push(outcome);
  recordStats(stats, playerMove, prev, prev2);
  saveAll();

  renderRoundResult(playerMove, computerMove, outcome, reason);
  $('player-score').textContent   = match.playerScore;
  $('computer-score').textContent = match.computerScore;
  appendRoundPip(outcome);

  const over = match.playerScore >= match.winsNeeded || match.computerScore >= match.winsNeeded;
  if (over) {
    setTimeout(endMatch, 900);
  } else {
    setTimeout(function() { setChoicesDisabled(false); }, 700);
  }
}

function renderRoundResult(playerMove, computerMove, outcome, reason) {
  $('result-area').className = 'result-area ' + outcome;
  $('idle-prompt').style.display = 'none';
  $('result-row').style.display  = 'flex';

  $('player-choice-display').textContent   = EMOJI[playerMove];
  $('computer-choice-display').textContent = EMOJI[computerMove];

  const labels = { win: 'You win!', loss: 'You lose', tie: 'Tie' };
  $('result-outcome').textContent = labels[outcome];
  $('result-outcome').className   = 'result-outcome ' + outcome;

  ['player-choice-display', 'computer-choice-display'].forEach(function(id) {
    const el = $(id);
    el.classList.remove('pop-in');
    void el.offsetWidth;
    el.classList.add('pop-in');
  });

  if (match.debug) {
    $('debug-info').style.display = 'block';
    $('debug-info').textContent   = 'AI reasoning: ' + reason;
  }
}

function appendRoundPip(outcome) {
  const pip = document.createElement('span');
  pip.className   = 'round-pip ' + outcome;
  pip.textContent = outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'T';
  $('round-history').appendChild(pip);
}

function recordStats(stats, move, prev, prev2) {
  stats.totals[move]++;
  if (prev) {
    if (!stats.order1[prev]) stats.order1[prev] = { rock: 0, paper: 0, scissors: 0 };
    stats.order1[prev][move] = (stats.order1[prev][move] || 0) + 1;
  }
  if (prev2 && prev) {
    const key = prev2 + ',' + prev;
    if (!stats.order2[key]) stats.order2[key] = { rock: 0, paper: 0, scissors: 0 };
    stats.order2[key][move]++;
  }
}

document.querySelectorAll('.choice-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { playRound(btn.dataset.move); });
});

$('btn-game-stats').addEventListener('click', function() {
  match.statsReturn = 'screen-game';
  renderStatsScreen();
  show('screen-stats');
});

$('btn-end-game').addEventListener('click', endMatch);

// ── Match-over panel (shown in-game, replacing choice buttons) ───────────
function endMatch() {
  const won  = match.playerScore > match.computerScore;
  const tied = match.playerScore === match.computerScore;
  const scoreText = match.playerScore + ' – ' + match.computerScore;
  const contextText = match.bestOf === 0
    ? scoreText
    : scoreText + '  (best of ' + match.bestOf + ')';

  $('mop-icon').textContent     = won ? '🏆' : tied ? '🤝' : '💻';
  $('mop-title').textContent    = won ? 'You Won!' : tied ? "It's a Tie!" : 'Computer Wins';
  $('mop-subtitle').textContent = contextText;

  // Swap choice buttons for the panel
  $('choices-row').style.display      = 'none';
  $('round-history').style.display    = 'none';
  $('match-over-panel').style.display = 'block';
}

$('mop-play-again').addEventListener('click', startMatch);
$('mop-view-stats').addEventListener('click', function() {
  match.statsReturn = 'screen-game';
  renderStatsScreen();
  show('screen-stats');
});
$('mop-change-settings').addEventListener('click', function() {
  renderSettingsScreen();
  show('screen-settings');
});
$('mop-switch-player').addEventListener('click', function() {
  renderProfileScreen();
  show('screen-profile');
});

// ── Stats screen ─────────────────────────────────────────────
function renderStatsScreen() {
  const stats = activeStats();
  $('stats-profile-name').textContent = match.player;

  const total = Object.values(stats.totals).reduce(function(a, b) { return a + b; }, 0);
  $('stats-totals').innerHTML = CHOICES.map(function(m) {
    const pct = total > 0 ? Math.round(stats.totals[m] / total * 100) : 0;
    return '<div class="stat-cell">'
      + '<div class="stat-emoji">' + EMOJI[m] + '</div>'
      + '<div class="stat-name">'  + m + '</div>'
      + '<div class="stat-count">' + stats.totals[m] + '</div>'
      + '<div class="stat-bar-wrap"><div class="stat-bar" style="width:' + pct + '%"></div></div>'
      + '<div class="stat-pct">'   + pct + '%</div>'
      + '</div>';
  }).join('');

  $('stats-order1').innerHTML =
    '<thead><tr><th>After ↓ / Next →</th>'
    + CHOICES.map(function(m) { return '<th>' + EMOJI[m] + ' ' + m + '</th>'; }).join('')
    + '</tr></thead><tbody>'
    + CHOICES.map(function(from) {
        const row = stats.order1[from] || {};
        return '<tr><th>' + EMOJI[from] + ' ' + from + '</th>'
          + CHOICES.map(function(to) { return '<td>' + (row[to] || 0) + '</td>'; }).join('')
          + '</tr>';
      }).join('')
    + '</tbody>';
}

$('btn-stats-back').addEventListener('click', function() {
  show(match.statsReturn || 'screen-game');
});

// ── Boot ─────────────────────────────────────────────────────
loadAll();
renderProfileScreen();
show('screen-profile');
