import { defaultStats, defaultConfig } from './constants.js';

const STATS_KEY  = 'rps_stats';
const CONFIG_KEY = 'rps_config';

// Module-level state — mirrors the Python STATS_WRAPPER / CONFIG_WRAPPER globals
export const state = {
  stats:  { profiles: {} },
  config: { profiles: {}, last_profile: null },
};

export function loadAll() {
  try {
    const s = localStorage.getItem(STATS_KEY);
    if (s) {
      const data = JSON.parse(s);
      // migrate legacy single-player schema
      state.stats = ('profiles' in data) ? data : { profiles: { Default: data } };
    }
  } catch (_) { /* non-fatal */ }

  try {
    const c = localStorage.getItem(CONFIG_KEY);
    if (c) {
      const data = JSON.parse(c);
      if ('profiles' in data) {
        state.config = { profiles: {}, last_profile: null, ...data };
      } else {
        state.config = { profiles: { Default: data }, last_profile: 'Default' };
      }
    }
  } catch (_) { /* non-fatal */ }
}

export function saveAll() {
  try { localStorage.setItem(STATS_KEY,  JSON.stringify(state.stats));  } catch (_) {}
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config)); } catch (_) {}
}

/** Ensure a profile exists in both wrappers; returns { stats, config } for that profile. */
export function ensureProfile(name) {
  if (!state.stats.profiles[name])  state.stats.profiles[name]  = defaultStats();
  if (!state.config.profiles[name]) state.config.profiles[name] = defaultConfig();
  return {
    stats:  state.stats.profiles[name],
    config: state.config.profiles[name],
  };
}

export function profileNames() {
  const names = new Set([
    ...Object.keys(state.stats.profiles),
    ...Object.keys(state.config.profiles),
  ]);
  return [...names].sort();
}
