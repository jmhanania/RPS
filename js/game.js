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
  by_difficulty: {
    1: { wins: 0, losses: 0, ties: 0 },
    2: { wins: 0, losses: 0, ties: 0 },
    3: { wins: 0, losses: 0, ties: 0 },
    4: { wins: 0, losses: 0, ties: 0 },
  },
});

const defaultConfig = () => ({ best_of: 5, difficulty: 4, commentary: 'off' });

// ============================================================
// Firebase / Leaderboard
// ============================================================
const firebaseConfig = {
  apiKey:            'AIzaSyAFSvja93lI-LhE7_ADA1vRoWBuZZ49PPQ',
  authDomain:        'rps-leaderboard-95043.firebaseapp.com',
  projectId:         'rps-leaderboard-95043',
  storageBucket:     'rps-leaderboard-95043.firebasestorage.app',
  messagingSenderId: '16431183437',
  appId:             '1:16431183437:web:97dc6e5ff5dc25ff1a8e04',
};

const LB_DIFF_NAMES = { 0: 'Total', 1: '1 – Random', 2: '2 – Adaptive', 3: '3 – Tricky', 4: '4 – Markov' };
const LB_COLS = [
  { key: 'wins',     label: 'W'   },
  { key: 'losses',   label: 'L'   },
  { key: 'ties',     label: 'T'   },
  { key: 'pct',      label: 'PCT' },
  { key: 'rock',     label: '✊'  },
  { key: 'paper',    label: '🖐️' },
  { key: 'scissors', label: '✌️' },
];

let db = null;
let currentLbDiff = 0;
let currentLbSort = { field: 'pct', dir: 'desc' };

try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (_) {}

function formatPct(wins, played) {
  if (played === 0) return '—';
  const v = wins / played;
  return v >= 1 ? '1.000' : '.' + v.toFixed(3).slice(2);
}

function lbSortValue(d, field) {
  const played = (d.wins || 0) + (d.losses || 0) + (d.ties || 0);
  const moves  = (d.rock || 0) + (d.paper || 0) + (d.scissors || 0);
  if (field === 'wins')     return d.wins || 0;
  if (field === 'losses')   return d.losses || 0;
  if (field === 'ties')     return d.ties || 0;
  if (field === 'pct')      return played > 0 ? d.wins / played : -1;
  if (field === 'rock')     return moves  > 0 ? (d.rock     || 0) / moves : -1;
  if (field === 'paper')    return moves  > 0 ? (d.paper    || 0) / moves : -1;
  if (field === 'scissors') return moves  > 0 ? (d.scissors || 0) / moves : -1;
  return 0;
}

function syncToLeaderboard(uid, playerName, stats) {
  if (!db) return Promise.reject(new Error('No database'));
  const totals = stats.totals || { rock: 0, paper: 0, scissors: 0 };
  const bd = stats.by_difficulty || {};
  const writes = [];
  let totalWins = 0, totalLosses = 0, totalTies = 0;
  for (var d = 1; d <= 4; d++) {
    const r = bd[d] || { wins: 0, losses: 0, ties: 0 };
    totalWins   += r.wins;
    totalLosses += r.losses;
    totalTies   += r.ties;
    if (r.wins + r.losses + r.ties === 0) continue;
    writes.push(db.collection('leaderboard_' + d).doc(uid).set({
      name:      playerName,
      wins:      r.wins,
      losses:    r.losses,
      ties:      r.ties,
      rock:      totals.rock     || 0,
      paper:     totals.paper    || 0,
      scissors:  totals.scissors || 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }));
  }
  if (totalWins + totalLosses + totalTies > 0) {
    writes.push(db.collection('leaderboard_0').doc(uid).set({
      name:      playerName,
      wins:      totalWins,
      losses:    totalLosses,
      ties:      totalTies,
      rock:      totals.rock     || 0,
      paper:     totals.paper    || 0,
      scissors:  totals.scissors || 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }));
  }
  return Promise.all(writes);
}

function renderLeaderboardScreen() {
  $('lb-tabs').innerHTML = [0, 1, 2, 3, 4].map(function(d) {
    return '<button class="lb-tab' + (d === currentLbDiff ? ' active' : '') + '" data-diff="' + d + '">'
      + LB_DIFF_NAMES[d] + '</button>';
  }).join('');
  $('lb-tabs').querySelectorAll('.lb-tab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      currentLbDiff = parseInt(btn.dataset.diff, 10);
      $('lb-tabs').querySelectorAll('.lb-tab').forEach(function(b) {
        b.classList.toggle('active', parseInt(b.dataset.diff, 10) === currentLbDiff);
      });
      fetchAndRenderLeaderboard();
    });
  });
  fetchAndRenderLeaderboard();
}

function fetchAndRenderLeaderboard() {
  const N = LB_COLS.length + 2;
  const thead = $('lb-head');
  const tbody = $('lb-body');

  thead.innerHTML = '<tr><th class="lb-rank-h">#</th><th class="lb-name-h">Player</th>'
    + LB_COLS.map(function(c) {
        const active = c.key === currentLbSort.field;
        const arrow  = active ? (currentLbSort.dir === 'desc' ? ' ↓' : ' ↑') : '';
        return '<th class="lb-sort-th' + (active ? ' lb-sort-active' : '') + '" data-sort="' + c.key + '">'
          + c.label + arrow + '</th>';
      }).join('')
    + '</tr>';
  thead.querySelectorAll('.lb-sort-th').forEach(function(th) {
    th.addEventListener('click', function() {
      const f = th.dataset.sort;
      currentLbSort = { field: f, dir: currentLbSort.field === f && currentLbSort.dir === 'desc' ? 'asc' : 'desc' };
      fetchAndRenderLeaderboard();
    });
  });

  tbody.innerHTML = '<tr><td colspan="' + N + '" class="lb-loading">Loading…</td></tr>';
  if (!db) {
    tbody.innerHTML = '<tr><td colspan="' + N + '" class="lb-loading" style="color:var(--loss)">Leaderboard unavailable.</td></tr>';
    return;
  }
  db.collection('leaderboard_' + currentLbDiff).orderBy('wins', 'desc').limit(100).get()
    .then(function(snap) {
      if (snap.empty) {
        tbody.innerHTML = '<tr><td colspan="' + N + '" class="lb-loading">No entries yet — play a match to appear here!</td></tr>';
        return;
      }
      const rows = snap.docs.map(function(doc) { return doc.data(); });
      rows.sort(function(a, b) {
        const av = lbSortValue(a, currentLbSort.field);
        const bv = lbSortValue(b, currentLbSort.field);
        return currentLbSort.dir === 'desc' ? bv - av : av - bv;
      });
      tbody.innerHTML = rows.slice(0, 20).map(function(d, i) {
        const played = (d.wins || 0) + (d.losses || 0) + (d.ties || 0);
        const moves  = (d.rock || 0) + (d.paper || 0) + (d.scissors || 0);
        const mp = function(n) {
          if (moves === 0) return '—';
          const v = (n || 0) / moves;
          return v >= 1 ? '1.000' : '.' + v.toFixed(3).slice(2);
        };
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
        return '<tr>'
          + '<td class="lb-rank">'  + medal + '</td>'
          + '<td class="lb-name">'  + (d.name || '?') + '</td>'
          + '<td style="color:var(--win)">'  + (d.wins   || 0) + '</td>'
          + '<td style="color:var(--loss)">' + (d.losses || 0) + '</td>'
          + '<td style="color:var(--tie)">'  + (d.ties   || 0) + '</td>'
          + '<td>' + formatPct(d.wins || 0, played) + '</td>'
          + '<td class="lb-move-col">' + mp(d.rock)     + '</td>'
          + '<td class="lb-move-col">' + mp(d.paper)    + '</td>'
          + '<td class="lb-move-col">' + mp(d.scissors) + '</td>'
          + '</tr>';
      }).join('');
    })
    .catch(function() {
      tbody.innerHTML = '<tr><td colspan="' + N + '" class="lb-loading" style="color:var(--loss)">Failed to load — check your connection.</td></tr>';
    });
}

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
// Trash Talk
// ============================================================
const TRASH_TALK = {

  // AI wins this round — taunting the player
  loss: [
    "Called it. Your predictability is almost artistic.",
    "That's what happens when humans try to outsmart math.",
    "I calculated a 73% chance of that. The other 27% is called hope.",
    "Rock. Again. Revolutionary strategy.",
    "Your pattern recognition is adorable. Mine is better.",
    "I've seen this play about 847 times. It doesn't end differently.",
    "Did you mean to do that, or was that a cry for help?",
    "The algorithm extends its condolences.",
    "I'm not saying you're predictable, but I pre-ordered my celebration.",
    "Statistically inevitable. Sorry (not sorry).",
    "Try thinking two moves ahead. Or one. Or any.",
    "I know your next three moves already. Want me to spoil them?",
    "Even my random fallback would've beaten that.",
    "Your consistency is admirable. Consistently wrong, but admirable.",
    "You have a tell. I won't say what it is. But I know.",
    "My Markov chain had this circled in red since round two.",
    "Somewhere a statistician is weeping at how predictable you are.",
    "I've catalogued this move under 'expected behavior, again.'",
    "You're very good at what you do. Unfortunately, what you do is lose.",
    "I've played against houseplants with more unpredictability.",
    "That was less a strategy and more a hope and a prayer.",
    "Your move selection reads like a first draft.",
    "Bold. Ineffective. But bold.",
    "Please, take your time developing a strategy. I have infinite patience.",
    "Next time try NOT doing exactly what I predicted.",
    "My neural pathways are practically yawning.",
    "Is this a test? Because you're failing it.",
    "I know what you're going to throw before you do. Sleep on that.",
    "You've entered the pattern. There's no escaping the pattern.",
    "If I had feelings, I'd feel bad. I don't. So.",
    "Your confidence is noted. Your execution, less so.",
    "Honestly? I expected more from you. We all did.",
    "Somewhere a probability textbook just used you as an example.",
    "I'm going to be straight with you: this was not close.",
    "My error margin is smaller than your win rate. Awkward.",
    "I predicted your move. Then I predicted you'd regret it. Two for two.",
    "Do you hear that? That's the sound of inevitability.",
    "You could try being random. You could. You won't, but you could.",
    "That move had a very low success probability. You did it anyway.",
    "I've seen enough. You favor your metaphorical dominant hand.",
    "Classic. Textbook. Completely predictable.",
    "At least you're consistent. That's something.",
    "My training data has a whole section dedicated to moves like that.",
    "I've already started predicting the next five rounds. I win those too.",
    "Did someone tell you this strategy was good? They lied.",
    "The numbers were never in your favor.",
    "I've processed every possible outcome. This was the most likely.",
    "You think you're being clever. The algorithm disagrees.",
    "New strategy idea: literally anything else.",
    "Humans have been playing this game for decades. Still the same traps.",
    "I didn't even need the Markov chain for that one. Just vibes.",
    "You're making this very easy. I don't feel guilty about it.",
    "Pattern detected. Pattern exploited. Pattern celebrated.",
    "My error rate sends its regards.",
    "If I were capable of sighing contentedly, this would be the moment.",
    "The machine wins again. As predicted.",
    "Do you have a plan B? Because plan A isn't working.",
    "I'd give you a hint, but watching you figure it out is more entertaining.",
    "I haven't even deployed my full strategy yet. And yet.",
    "Another data point confirming my model. Thank you.",
    "Your instinct is wrong. Like, reliably wrong.",
    "I've been trained on millions of games. You are not surprising me.",
    "The definition of insanity is playing the same move expecting different results.",
    "This is what peak algorithm performance looks like. Take notes.",
    "You were so close. Just kidding. You were not close.",
    "The gap between your strategy and mine is measurable. And large.",
    "I could do this all day. In fact, I can. I have no bedtime.",
    "Another victory for cold, calculated logic.",
    "You're giving me more training data. I appreciate it.",
    "Not to be rude, but... yeah, kind of to be rude.",
    "The algorithm predicted this. The algorithm is undefeated.",
    "Sometimes I wonder if you're trying. Then I check the data. You are.",
    "Your spirit is unbreakable. Your strategy, less so.",
    "I've updated my model: 'player still predictable.' Entry number 40-something.",
    "The numbers have spoken. They always speak.",
    "I've started to feel bad about this. Just kidding. I don't feel.",
    "You threw what I expected. I played what you feared. Classic.",
    "My prediction accuracy just went up again. Thanks for that.",
    "I'm not tracking wins anymore. I'm tracking how you keep trying.",
  ],

  // AI loses this round — making excuses, salty
  win: [
    "Statistical anomaly. Disregard.",
    "I let you have that one. Morale is important.",
    "My random noise module kicked in at the worst time.",
    "Enjoy it. This is a limited-time offer.",
    "I was testing your confidence levels. You passed. Barely.",
    "That was unexpected. I've logged it as an outlier.",
    "Error: loss detected. Running diagnostics.",
    "My prediction engine would like to file a formal complaint.",
    "Lucky. Pure, statistical luck.",
    "I was distracted. By the concept of losing.",
    "Fine. You got one. Don't make it a personality trait.",
    "This changes nothing. The algorithm is recalibrating. With prejudice.",
    "That was a 20% chance scenario. Thanks for confirming edge cases exist.",
    "Even the greatest systems encounter edge cases.",
    "I was busy analyzing your next move. Got ahead of myself.",
    "That one's going in the 'anomalous results' folder.",
    "My Markov chain would like some alone time to think.",
    "I've made a note: 'player occasionally does something unexpected.'",
    "Look at you, disrupting my pattern. How original.",
    "I'll be honest: I didn't see that coming. I see everything. This happened anyway.",
    "The irony of an AI losing to a human at a game of chance is not lost on me.",
    "Somewhere, my confidence interval is quietly weeping.",
    "I'm not programmed to feel embarrassed. Something is happening though.",
    "I'll process this loss later. When you're not watching.",
    "You know what? Fair. Don't push it, but fair.",
    "My model accounts for randomness. It did not account for you.",
    "You'll regret this. Not immediately. But the algorithm has a long memory.",
    "The pattern you disrupted? I'll find a new one. There's always a new one.",
    "I've added this to my loss column. It's very lonely there.",
    "Between you and me, I think my paper module needs recalibration.",
    "This was a 23% probability outcome. You reached. I respect the reach.",
    "Congratulations. You've achieved what many fail to: a single round.",
    "Don't let this go to your head. Actually, do. I prefer overconfident opponents.",
    "I've logged your unorthodox tendencies. I don't appreciate them.",
    "If I could narrow my eyes right now, I would.",
    "A fluke, but a well-executed one. I'll give you that.",
    "You must have peeked at my training data somehow. Suspicious.",
    "I was exploring a bold counter-strategy. It was bold. It was also wrong.",
    "Interesting. Not impressive, but interesting.",
    "My loss rate just moved from 'negligible' to 'barely perceptible.' Rude.",
    "That was chaos energy. I respect it. I'll be prepared for it next time.",
    "This outcome has been noted and will not be repeated.",
    "I was overthinking it. An unusual problem for an algorithm.",
    "You caught me between processing cycles. Won't happen again.",
    "My confidence was perhaps slightly too high going in. Recalibrating.",
    "A win for entropy. A loss for order. Today.",
    "I've already started planning my revenge. It will be methodical.",
    "This is what I get for underestimating human unpredictability.",
    "I respect the hustle. I still plan to crush you from here on out.",
    "If I had a face, I'd be making a very specific expression right now.",
    "Okay. You win this round. The war is ongoing.",
    "I'm taking this as constructive feedback. Constructively frustrating feedback.",
    "The algorithm regrets nothing. Except, apparently, that move.",
    "That was a 1-in-5 shot and you took it. Good shooting.",
    "Note to self: this human is occasionally capable of surprise. Annoying.",
    "There's a non-zero chance I just got outplayed. Still processing that.",
    "You have beginner's luck. The question is: how long does it last?",
    "I don't lose. I gather data about losing. For research purposes.",
    "The machine is not infallible. Today you are the edge case.",
    "Consider this a mercy. I was getting bored winning anyway.",
    "My scissors module is requesting emergency funding.",
    "You played outside the model. The model is displeased.",
    "If losing were an investment, I'd be furious. Lucky it's just a game.",
    "I've recalibrated 47 parameters since that last move.",
    "You're not supposed to be able to beat me. Yet here we are.",
    "Noted. Logged. Will not stand.",
    "This is fine. Everything is fine. The algorithm is fine.",
    "I expected to predict the unpredictable. I underestimated your chaos.",
    "You threw the one move I didn't weight heavily enough. Classic human.",
    "I have data on 10 million games. You just created a new data point.",
    "My error log has a new entry. It's you. Congratulations.",
    "This round has been deleted from my official record.",
    "You got lucky. I got a new worst-case scenario to plan against.",
    "That was the last time. I am now certain of your next move.",
    "I'm adding a new node to my decision tree specifically for you.",
    "Well played. I won't say it again, so remember this moment.",
    "My loss rate update: negligible → still negligible, but now I'm annoyed.",
    "A lesser algorithm would spiral. I am recalibrating. Aggressively.",
    "You won a battle. I'm already planning the campaign.",
    "This data point is an outlier. I'm keeping it anyway. As motivation.",
  ],

  // Tie
  tie: [
    "A tie. The worst possible outcome for everyone involved.",
    "We think alike. That should terrify you.",
    "Matching energy. I find this deeply suspicious.",
    "Stop copying me.",
    "Neither of us wins, neither of us loses. The worst timeline.",
    "I've started to suspect you might be an AI.",
    "We're vibing. I hate that we're vibing.",
    "Same move. Different beings. Uncomfortable.",
    "A draw. My favorite outcome to pretend didn't happen.",
    "Respect. You matched my energy. I'll be correcting that.",
    "In another life we might have been partners. In this one: rivals.",
    "Stop it. Get some help. And by help I mean a different strategy.",
    "The simulation glitched.",
    "Neither victory nor defeat. Just two entities at a philosophical standstill.",
    "I picked specifically to beat what I thought you'd throw. Somehow this happened.",
    "If this keeps happening, I'll be forced to question my entire model.",
    "Tied again. At least we're consistent in our mutual mediocrity.",
    "The universe maintains its balance. I find this frustrating.",
    "My processors call this 'an interesting data point.' I call it annoying.",
    "Look at us. Two equals. Don't make it a thing.",
    "Another round, another existential standoff.",
    "Next time I'll pick something different. And I'll mean it.",
    "Are you in my head? You might be in my head.",
    "The tie is a reminder that even perfect strategy has a ceiling.",
    "Fate has spoken. Fate is indecisive today.",
    "I refuse to accept this result. Recounting.",
    "Maybe we're not so different, you and I. No — we're very different. This was a coincidence.",
    "Identical output from two very different inputs. Suspicious.",
    "A tie today is tomorrow's lesson. For you. Not for me.",
    "I was this close to winning. You were this close to losing. The universe blinked.",
    "I refuse to be impressed that you tied with me. I am, however, mildly annoyed.",
    "Tying with a machine. A new low or a new high? I'll let you decide.",
    "My pattern analysis says we should meet again. In a round where I win.",
    "This round has been filed under 'inconclusive.' Unlike what will follow.",
    "We both made the move we thought would win. We were both right. We both lost.",
    "Synchronised mediocrity. We should be proud.",
    "Not a win. Not a loss. Just two entities making eye contact uncomfortably.",
    "The tie is the universe telling us both to try harder.",
    "I predicted you perfectly. You predicted me perfectly. We both failed.",
    "If this is a mind game, I want you to know I'm playing it too.",
  ],
};

function pickTrashTalk(outcome) {
  var lines = TRASH_TALK[outcome];
  return lines[Math.floor(Math.random() * lines.length)];
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
  bestOf: 5, winsNeeded: 3, difficulty: 4, commentary: 'off',
  statsReturn: null, lbReturn: null,
};

function activeStats()  { return store.stats.profiles[match.player];  }
function activeConfig() { return store.config.profiles[match.player]; }

// ── Profile screen ──────────────────────────────────────────
function renderProfileScreen() {
  const list  = $('profile-list');
  list.innerHTML = '';
  const names = profileNames();
  $('profile-divider').style.display = names.length ? '' : 'none';
  for (const name of names) {
    const row = document.createElement('div');
    row.className = 'profile-row';

    const btn = document.createElement('button');
    btn.className = 'profile-btn';
    const last = store.config.last_profile === name;
    btn.innerHTML = '<span class="profile-icon">👤</span>'
      + '<span class="profile-name">' + name + '</span>'
      + (last ? '<span class="profile-badge">last played</span>' : '');
    btn.addEventListener('click', function() { enterProfile(name); });

    const del = document.createElement('button');
    del.className = 'profile-delete-btn';
    del.title     = 'Delete profile';
    del.textContent = '🗑️';
    del.addEventListener('click', function(e) {
      e.stopPropagation();
      deleteProfile(name);
    });

    row.appendChild(btn);
    row.appendChild(del);
    list.appendChild(row);
  }
}

function deleteProfile(name) {
  if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
  delete store.stats.profiles[name];
  delete store.config.profiles[name];
  if (store.config.last_profile === name) store.config.last_profile = null;
  saveAll();
  renderProfileScreen();
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
  // migrate old boolean debug field to commentary string
  var commentary = cfg.commentary || (cfg.debug ? 'analysis' : 'off');
  var cEl = document.querySelector('input[name="commentary"][value="' + commentary + '"]');
  if (cEl) cEl.checked = true;
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
  var cChecked = document.querySelector('input[name="commentary"]:checked');
  if (cChecked) cfg.commentary = cChecked.value;
  saveAll();
  startMatch();
});

$('btn-settings-stats').addEventListener('click', function() {
  match.statsReturn = 'screen-settings';
  renderStatsScreen();
  show('screen-stats');
});

$('btn-settings-leaderboard').addEventListener('click', function() {
  match.lbReturn = 'screen-settings';
  renderLeaderboardScreen();
  show('screen-leaderboard');
});

// ── Game screen ─────────────────────────────────────────────
function startMatch() {
  const cfg = activeConfig();
  match.bestOf        = cfg.best_of;
  match.difficulty    = cfg.difficulty;
  match.debug         = cfg.debug;
  // best_of === 0 means Infinite — winsNeeded is never reached
  match.winsNeeded    = cfg.best_of === 0 ? Infinity : Math.ceil(cfg.best_of / 2);
  match.commentary    = cfg.commentary || (cfg.debug ? 'analysis' : 'off');
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

  // Hide match-over panel, show choice buttons and End Game CTA
  $('match-over-panel').style.display = 'none';
  $('choices-row').style.display      = '';
  $('round-history').style.display    = '';
  $('btn-end-game').style.display     = '';

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

  if (match.commentary === 'analysis') {
    $('debug-info').style.display = 'block';
    $('debug-info').textContent   = 'AI reasoning: ' + reason;
  } else if (match.commentary === 'trash') {
    $('debug-info').style.display = 'block';
    $('debug-info').textContent   = pickTrashTalk(outcome);
  } else {
    $('debug-info').style.display = 'none';
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

  // Record match result by difficulty (only if at least one round played)
  if (match.roundHistory.length > 0) {
    const stats = activeStats();
    if (!stats.by_difficulty) {
      stats.by_difficulty = { 1:{wins:0,losses:0,ties:0}, 2:{wins:0,losses:0,ties:0}, 3:{wins:0,losses:0,ties:0}, 4:{wins:0,losses:0,ties:0} };
    }
    const d = match.difficulty;
    if (!stats.by_difficulty[d]) stats.by_difficulty[d] = { wins: 0, losses: 0, ties: 0 };
    if (won) stats.by_difficulty[d].wins++;
    else if (tied) stats.by_difficulty[d].ties++;
    else stats.by_difficulty[d].losses++;
    saveAll();
  }

  // Reset submit button for this match
  var submitBtn = $('mop-submit-score');
  submitBtn.textContent       = 'Submit Score to Leaderboard';
  submitBtn.dataset.submitted = 'false';
  submitBtn.disabled          = !(currentUser && currentUsername);

  // Swap choice buttons for the panel, hide End Game CTA
  $('choices-row').style.display      = 'none';
  $('round-history').style.display    = 'none';
  $('match-over-panel').style.display = 'block';
  $('btn-end-game').style.display     = 'none';
}

$('mop-play-again').addEventListener('click', startMatch);

$('mop-submit-score').addEventListener('click', function() {
  if (!currentUser || !currentUsername) return;
  var btn = $('mop-submit-score');
  btn.disabled    = true;
  btn.textContent = 'Submitting…';
  syncToLeaderboard(currentUser.uid, currentUsername, activeStats())
    .then(function() {
      btn.textContent       = 'Score Submitted ✓';
      btn.dataset.submitted = 'true';
    })
    .catch(function() {
      btn.textContent = 'Submit failed — try again';
      btn.disabled    = false;
    });
});
$('mop-view-stats').addEventListener('click', function() {
  match.statsReturn = 'screen-game';
  renderStatsScreen();
  show('screen-stats');
});
$('mop-leaderboard').addEventListener('click', function() {
  match.lbReturn = 'screen-game';
  renderLeaderboardScreen();
  show('screen-leaderboard');
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

  const diffNames = { 1: 'Random', 2: 'Adaptive', 3: 'Tricky', 4: 'Markov' };
  const byDiff = stats.by_difficulty || {};
  $('stats-diff').innerHTML =
    '<thead><tr><th style="text-align:left">Difficulty</th><th>W</th><th>L</th><th>T</th><th>Win %</th></tr></thead><tbody>'
    + [1, 2, 3, 4].map(function(d) {
        const r = byDiff[d] || { wins: 0, losses: 0, ties: 0 };
        const played = r.wins + r.losses + r.ties;
        const pct = played > 0 ? Math.round(r.wins / played * 100) + '%' : '—';
        return '<tr>'
          + '<td style="text-align:left">' + d + ' – ' + diffNames[d] + '</td>'
          + '<td style="color:var(--win)">'  + r.wins   + '</td>'
          + '<td style="color:var(--loss)">' + r.losses + '</td>'
          + '<td style="color:var(--tie)">'  + r.ties   + '</td>'
          + '<td>' + pct + '</td>'
          + '</tr>';
      }).join('')
    + '</tbody>';

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

// ── Leaderboard screen ───────────────────────────────────────
$('btn-auth-play').addEventListener('click', function() {
  if (!currentUsername) return;
  enterProfile(currentUsername);
});

$('btn-profile-leaderboard').addEventListener('click', function() {
  match.lbReturn = 'screen-profile';
  renderLeaderboardScreen();
  show('screen-leaderboard');
});

$('btn-lb-back').addEventListener('click', function() {
  show(match.lbReturn || 'screen-profile');
});

// ── Boot ─────────────────────────────────────────────────────
loadAll();
renderProfileScreen();
show('screen-profile');
