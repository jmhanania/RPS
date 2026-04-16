export const CHOICES = ['rock', 'paper', 'scissors'];

// key beats value
export const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

// AI exploration rates per difficulty
export const EPSILON_ADAPTIVE = 0.20;
export const EPSILON_TRICKY   = 0.25;
export const EPSILON_MARKOV   = 0.20;

// Markov confidence thresholds
export const MIN_SUPPORT = 3;
export const MIN_MARGIN  = 0.40;

// Weight given to persisted (historical) stats vs. live match counts
export const PERSIST_WEIGHT = 0.50;

// Deep-copy defaults (plain functions so each profile gets its own object)
export const defaultStats = () => ({
  totals: { rock: 0, paper: 0, scissors: 0 },
  order1: {
    rock:     { rock: 0, paper: 0, scissors: 0 },
    paper:    { rock: 0, paper: 0, scissors: 0 },
    scissors: { rock: 0, paper: 0, scissors: 0 },
  },
  order2: {},
});

export const defaultConfig = () => ({ best_of: 5, difficulty: 4, debug: false });
