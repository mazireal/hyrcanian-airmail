// Campaign progress kept in localStorage; every access is guarded so the
// game still runs from a plain file where storage may be unavailable.

import { freshProgress } from './missions.js';

const KEY = 'hyrcanian-airmail-progress-v1';

export function loadProgress() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return freshProgress();
    const parsed = JSON.parse(raw);
    const base = freshProgress();
    return {
      unlocked: Math.max(1, Math.min(6, parsed.unlocked ?? base.unlocked)),
      stars: parsed.stars ?? {},
      credits: parsed.credits ?? 0,
      upgrades: { ...base.upgrades, ...(parsed.upgrades ?? {}) },
    };
  } catch {
    return freshProgress();
  }
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage blocked: the campaign simply lasts for this sitting.
  }
}
