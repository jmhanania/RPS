import { CHOICES, BEATS, defaultStats, defaultConfig } from './constants.js';
import { state as store, loadAll, saveAll, ensureProfile, profileNames } from './persistence.js';
import { getComputerChoice } from './ai.js';

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
const $  = id => document.getElementById(id);
const show = id => {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
};

// ---------------------------------------------------------------------------
// Match state
// ---------------------------------------------------------------------------
const match = {
  player:        null,   // profile name
  history:       [],     // player moves this match
  roundHistory:  [],     // 'win' | 'loss' | 'tie' per round
  playerScore:   0,
  computerScore: 0,
  bestOf:        5,
  winsNeeded:    3,
  difficulty:    4,
  debug:         false,
  statsReturn:   null,   // screen to return to from stats
};

function activeStats()  { return store.stats.profiles[match.player];  }
function activeConfig() { return store.config.profiles[match.player]; }

// ---------------------------------------------------------------------------
// Profile screen
// ---------------------------------------------------------------------------
function renderProfileScreen() {
  const list = $('profile-list');
  list.innerHTML = '';
  const names = profileNames();
  if (!names.length) {
    const msg = document.createElement('p');
    msg.className = 'empty-msg';
    msg.textContent = 'No profiles yet — create one below.';
    list.appendChild(msg);
  }
  for (const name of names) {
    const btn = document.createElement('button');
    btn.className = 'profile-btn';
    const last = store.config.last_profile === name;
    btn.innerHTML = `<span class="profile-icon">👤</span><span class="profile-name">${name}</span>${last ? '<span class="profile-badge">last played</span>' : ''}`;
    btn.addEventListener('click', () => enterProfile(name));
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

$('btn-create-profile').addEventListener('click', () => {
  const name = $('new-profile-name').value.trim();
  if (!name) return;
  $('new-profile-name').value = '';
  enterProfile(name);
});
$('new-profile-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('btn-create-profile').click();
});

// ---------------------------------------------------------------------------
// Settings screen
// ---------------------------------------------------------------------------
function renderSettingsScreen() {
  $('settings-profile-name').textContent = match.player;
  const cfg = activeConfig();
  const boRadio = document.querySelector(`input[name="best_of"][value="${cfg.best_of}"]`);
  if (boRadio) boRadio.checked = true;
  const dRadio = document.querySelector(`input[name="difficulty"][value="${cfg.difficulty}"]`);
  if (dRadio) dRadio.checked = true;
  $('debug-toggle').checked = cfg.debug || false;
}

$('btn-settings-back').addEventListener('click', () => {
  renderProfileScreen();
  show('screen-profile');
});

$('btn-settings-play').addEventListener('click', () => {
  const cfg = activeConfig();
  const boChecked = document.querySelector('input[name="best_of"]:checked');
  const dChecked  = document.querySelector('input[name="difficulty"]:checked');
  if (boChecked) cfg.best_of   = parseInt(boChecked.value, 10);
  if (dChecked)  cfg.difficulty = parseInt(dChecked.value,  10);
  cfg.debug = $('debug-toggle').checked;
  saveAll();
  startMatch();
});

// ---------------------------------------------------------------------------
// Game screen
// ---------------------------------------------------------------------------
const EMOJI = { rock: '✊', paper: '🖐️', scissors: '✌️' };

function startMatch() {
  const cfg = activeConfig();
  match.bestOf        = cfg.best_of;
  match.difficulty    = cfg.difficulty;
  match.debug         = cfg.debug;
  match.winsNeeded    = Math.ceil(cfg.best_of / 2);
  match.history       = [];
  match.roundHistory  = [];
  match.playerScore   = 0;
  match.computerScore = 0;

  $('player-name-display').textContent = match.player;
  $('match-label').textContent = `Best of ${match.bestOf}`;
  $('player-score').textContent  = '0';
  $('computer-score').textContent = '0';
  $('result-area').className = 'result-area idle';
  $('result-row').style.display  = 'none';
  $('idle-prompt').style.display = 'block';
  $('round-history').innerHTML = '';
  $('debug-info').style.display = 'none';

  setChoicesDisabled(false);
  show('screen-game');
}

function setChoicesDisabled(disabled) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = disabled;
  });
}

function playRound(playerMove) {
  setChoicesDisabled(true);

  const stats = activeStats();
  const [computerMove, reason] = getComputerChoice(match.difficulty, match.history, stats);

  // Outcome
  let outcome;
  if (playerMove === computerMove)           outcome = 'tie';
  else if (BEATS[playerMove] === computerMove) outcome = 'win';
  else                                         outcome = 'loss';

  // Scores
  if (outcome === 'win')  match.playerScore++;
  if (outcome === 'loss') match.computerScore++;

  // Update stats
  const prev  = match.history[match.history.length - 1] ?? null;
  const prev2 = match.history[match.history.length - 2] ?? null;
  match.history.push(playerMove);
  match.roundHistory.push(outcome);
  recordStats(stats, playerMove, prev, prev2);
  saveAll();

  // Render
  renderRoundResult(playerMove, computerMove, outcome, reason);
  $('player-score').textContent  = match.playerScore;
  $('computer-score').textContent = match.computerScore;
  appendRoundPip(outcome);

  // Check match end
  const over = match.playerScore >= match.winsNeeded || match.computerScore >= match.winsNeeded;
  if (over) {
    setTimeout(endMatch, 900);
  } else {
    setTimeout(() => setChoicesDisabled(false), 700);
  }
}

function renderRoundResult(playerMove, computerMove, outcome, reason) {
  const area = $('result-area');
  area.className = `result-area ${outcome}`;

  $('idle-prompt').style.display = 'none';
  $('result-row').style.display  = 'flex';
  $('player-choice-display').textContent   = EMOJI[playerMove];
  $('computer-choice-display').textContent = EMOJI[computerMove];

  const label = { win: 'You win!', loss: 'You lose', tie: 'Tie' }[outcome];
  $('result-outcome').textContent  = label;
  $('result-outcome').className    = `result-outcome ${outcome}`;

  // Trigger re-animation
  ['player-choice-display', 'computer-choice-display'].forEach(id => {
    const el = $(id);
    el.classList.remove('pop-in');
    void el.offsetWidth;
    el.classList.add('pop-in');
  });

  if (match.debug) {
    $('debug-info').style.display = 'block';
    $('debug-info').textContent   = `AI reasoning: ${reason}`;
  }
}

function appendRoundPip(outcome) {
  const pip = document.createElement('span');
  pip.className = `round-pip ${outcome}`;
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
    const key = `${prev2},${prev}`;
    if (!stats.order2[key]) stats.order2[key] = { rock: 0, paper: 0, scissors: 0 };
    stats.order2[key][move]++;
  }
}

// Choice buttons
document.querySelectorAll('.choice-btn').forEach(btn => {
  btn.addEventListener('click', () => playRound(btn.dataset.move));
});

// Header buttons
$('btn-menu').addEventListener('click', () => {
  renderProfileScreen();
  show('screen-profile');
});
$('btn-game-stats').addEventListener('click', () => {
  match.statsReturn = 'screen-game';
  renderStatsScreen();
  show('screen-stats');
});

// ---------------------------------------------------------------------------
// Match over screen
// ---------------------------------------------------------------------------
function endMatch() {
  const won  = match.playerScore > match.computerScore;
  const tied = match.playerScore === match.computerScore;
  $('match-result-icon').textContent     = won ? '🏆' : tied ? '🤝' : '💻';
  $('match-result-title').textContent    = won ? 'You Won!' : tied ? "It's a Tie!" : 'Computer Wins';
  $('match-result-subtitle').textContent = `${match.playerScore} – ${match.computerScore}  (best of ${match.bestOf})`;
  show('screen-match-over');
}

$('btn-play-again').addEventListener('click',     startMatch);
$('btn-match-stats').addEventListener('click',    () => {
  match.statsReturn = 'screen-match-over';
  renderStatsScreen();
  show('screen-stats');
});
$('btn-switch-player').addEventListener('click',  () => { renderProfileScreen(); show('screen-profile'); });
$('btn-change-settings').addEventListener('click', () => { renderSettingsScreen(); show('screen-settings'); });

// ---------------------------------------------------------------------------
// Stats screen
// ---------------------------------------------------------------------------
function renderStatsScreen() {
  const stats = activeStats();
  $('stats-profile-name').textContent = match.player;

  // Totals
  const total    = Object.values(stats.totals).reduce((a, b) => a + b, 0);
  $('stats-totals').innerHTML = CHOICES.map(m => {
    const pct = total > 0 ? Math.round(stats.totals[m] / total * 100) : 0;
    return `
      <div class="stat-cell">
        <div class="stat-emoji">${EMOJI[m]}</div>
        <div class="stat-name">${m}</div>
        <div class="stat-count">${stats.totals[m]}</div>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${pct}%"></div></div>
        <div class="stat-pct">${pct}%</div>
      </div>`;
  }).join('');

  // Order-1 transition table
  $('stats-order1').innerHTML =
    `<thead><tr><th>After ↓ / Next →</th>${CHOICES.map(m => `<th>${EMOJI[m]} ${m}</th>`).join('')}</tr></thead>` +
    `<tbody>${CHOICES.map(from => {
      const row = stats.order1[from] || {};
      return `<tr><th>${EMOJI[from]} ${from}</th>${CHOICES.map(to => `<td>${row[to] || 0}</td>`).join('')}</tr>`;
    }).join('')}</tbody>`;
}

$('btn-stats-back').addEventListener('click', () => {
  show(match.statsReturn || 'screen-match-over');
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
loadAll();
const last = store.config.last_profile;
if (last && store.config.profiles[last]) {
  match.player = last;
  renderSettingsScreen();
  show('screen-settings');
} else {
  renderProfileScreen();
  show('screen-profile');
}
