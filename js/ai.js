import {
  CHOICES, BEATS,
  EPSILON_ADAPTIVE, EPSILON_TRICKY, EPSILON_MARKOV,
  MIN_SUPPORT, MIN_MARGIN, PERSIST_WEIGHT,
} from './constants.js';

/** Return the move that beats `move`. */
function counterOf(move) {
  for (const [k, v] of Object.entries(BEATS)) {
    if (v === move) return k;
  }
  throw new Error(`Unknown move: ${move}`);
}

/** Analyse a counts dict → [topMove, topCount, nextCount, margin]. */
function topWithSupport(counts) {
  const items = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!items.length) return [null, 0, 0, 0];
  const [topMove, topCt] = items[0];
  const nextCt = items.length > 1 ? items[1][1] : 0;
  const total  = Object.values(counts).reduce((a, b) => a + b, 0);
  const margin = total > 0 ? (topCt - nextCt) / total : 0;
  return [topMove, topCt, nextCt, margin];
}

/** Predict using all-history frequency + last-`window` moves weighted double. */
function recentWeightedPrediction(history, window = 5) {
  const weights = { rock: 0, paper: 0, scissors: 0 };
  for (const m of history)              weights[m] += 1;
  for (const m of history.slice(-window)) weights[m] += 1;
  const predicted = Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
  return [predicted, `recent-weighted prediction: ${predicted} (last ${Math.min(window, history.length)} moves weighted).`];
}

/**
 * Markov prediction (order-2 → order-1 → null).
 * `persistedStats` is the active profile's stats dict from persistence.js.
 */
function predictNextMoveMarkov(history, persistedStats) {
  const n = history.length;

  function combine(live, persist) {
    const out = { rock: 0, paper: 0, scissors: 0 };
    for (const m of CHOICES) {
      out[m] = (live[m] || 0) + PERSIST_WEIGHT * (persist[m] || 0);
    }
    return out;
  }

  // Order-2
  if (n >= 3) {
    const [l0, l1] = history.slice(-2);
    const live2 = { rock: 0, paper: 0, scissors: 0 };
    for (let i = 0; i < n - 2; i++) {
      if (history[i] === l0 && history[i + 1] === l1) live2[history[i + 2]]++;
    }
    const key2    = `${l0},${l1}`;
    const saved2  = persistedStats.order2[key2] || { rock: 0, paper: 0, scissors: 0 };
    const counts2 = combine(live2, saved2);
    const [top, topCt, , margin] = topWithSupport(counts2);
    if (top && topCt >= MIN_SUPPORT && margin >= MIN_MARGIN) {
      return [top, `Order-2 Markov (support=${topCt.toFixed(0)}, margin=${margin.toFixed(2)}) after [${l0}, ${l1}].`];
    }
  }

  // Order-1
  if (n >= 2) {
    const last1  = history[n - 1];
    const live1  = { rock: 0, paper: 0, scissors: 0 };
    for (let i = 0; i < n - 1; i++) {
      if (history[i] === last1) live1[history[i + 1]]++;
    }
    const saved1  = (persistedStats.order1[last1]) || { rock: 0, paper: 0, scissors: 0 };
    const counts1 = combine(live1, saved1);
    const [top, topCt, , margin] = topWithSupport(counts1);
    if (top && topCt >= MIN_SUPPORT && margin >= MIN_MARGIN) {
      return [top, `Order-1 Markov (support=${topCt.toFixed(0)}, margin=${margin.toFixed(2)}) after ${last1}.`];
    }
  }

  return [null, 'No confident Markov pattern.'];
}

/**
 * Main entry point — mirrors Python's get_computer_choice().
 * @param {number}   difficulty    1–4
 * @param {string[]} history       player moves in current match
 * @param {object}   persistedStats  active profile stats from persistence.js
 * @returns {[string, string]}  [move, reason]
 */
export function getComputerChoice(difficulty, history, persistedStats) {
  const rand = () => CHOICES[Math.floor(Math.random() * CHOICES.length)];

  // D1: random (also used when no history yet)
  if (difficulty === 1 || !history.length) {
    return [rand(), 'Random pick (or no history yet).'];
  }

  // D2: Adaptive — counter all-time most common move
  if (difficulty === 2) {
    if (Math.random() < EPSILON_ADAPTIVE) return [rand(), `${EPSILON_ADAPTIVE * 100}% unpredictability (Adaptive).`];
    const counts = { rock: 0, paper: 0, scissors: 0 };
    for (const m of history) counts[m]++;
    const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return [counterOf(mostCommon), `Countering your most common move so far: ${mostCommon}.`];
  }

  // D3: Tricky — recent-weighted prediction
  if (difficulty === 3) {
    if (Math.random() < EPSILON_TRICKY) return [rand(), `${EPSILON_TRICKY * 100}% unpredictability (Tricky).`];
    const [predicted, why] = recentWeightedPrediction(history);
    return [counterOf(predicted), `Predicting you'll throw ${predicted} (${why}); I picked its counter.`];
  }

  // D4: Markov with recent-weighted fallback
  if (difficulty === 4) {
    if (Math.random() < EPSILON_MARKOV) return [rand(), `${EPSILON_MARKOV * 100}% unpredictability (Markov).`];
    const [predicted, why] = predictNextMoveMarkov(history, persistedStats);
    if (predicted === null) {
      const [p2, why2] = recentWeightedPrediction(history);
      return [counterOf(p2), `${why} Falling back: ${why2}`];
    }
    return [counterOf(predicted), `${why} I played its counter.`];
  }

  return [rand(), 'Fallback random (unknown difficulty).'];
}
