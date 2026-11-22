/**
 * Persistent Storage Wrapper for High Scores & Settings.
 * Safely handles private browsing mode or storage quotas with an in-memory fallback.
 */

import {
  HIGHSCORES_KEY,
  SETTINGS_KEY,
  MAX_HIGHSCORES,
  DEFAULT_SETTINGS,
  GameSettings,
} from '../config';

export interface HighScoreEntry {
  score: number;
  distance: number;
  max_streak: number;
  coins: number;
  date: string;
}

// In-memory fallback dictionary for private browsing or disabled storage
const memoryStore: Record<string, string> = {};

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__ssr_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const storageAvailable = isLocalStorageAvailable();

function getItem(key: string): string | null {
  if (storageAvailable) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memoryStore[key] || null;
    }
  }
  return memoryStore[key] || null;
}

function setItem(key: string, value: string): void {
  if (storageAvailable) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // Fall through to memoryStore on quota exceeded
    }
  }
  memoryStore[key] = value;
}

export function loadHighScores(): HighScoreEntry[] {
  try {
    const raw = getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => typeof item === 'object' && item !== null && typeof item.score === 'number')
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_HIGHSCORES);
    }
  } catch (e) {
    console.warn('[Storage] Failed to parse highscores:', e);
  }
  return [];
}

export function saveHighScore(
  score: number,
  distance: number,
  maxStreak: number,
  coins: number = 0
): { scores: HighScoreEntry[]; isNewRecord: boolean } {
  const scores = loadHighScores();
  const prevBest = scores.length > 0 ? scores[0].score : 0;
  const isNewRecord = score > prevBest && score > 0;

  if (score > 0) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const newEntry: HighScoreEntry = {
      score: Math.floor(score),
      distance: Math.floor(distance),
      max_streak: Math.floor(maxStreak),
      coins: Math.floor(coins),
      date: dateStr,
    };

    scores.push(newEntry);
    scores.sort((a, b) => b.score - a.score);
    const trimmed = scores.slice(0, MAX_HIGHSCORES);

    try {
      setItem(HIGHSCORES_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[Storage] Failed to save highscores:', e);
    }

    return { scores: trimmed, isNewRecord };
  }

  return { scores, isNewRecord: false };
}

export function loadSettings(): GameSettings {
  const settings: GameSettings = { ...DEFAULT_SETTINGS };
  try {
    const raw = getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        if (typeof parsed.smile_sensitivity === 'number') settings.smile_sensitivity = parsed.smile_sensitivity;
        if (typeof parsed.open_sensitivity === 'number') settings.open_sensitivity = parsed.open_sensitivity;
        if (typeof parsed.steer_sensitivity === 'number') settings.steer_sensitivity = parsed.steer_sensitivity;
        if (typeof parsed.music_enabled === 'boolean') settings.music_enabled = parsed.music_enabled;
      }
    }
  } catch (e) {
    console.warn('[Storage] Failed to load settings:', e);
  }
  return settings;
}

export function saveSettings(settings: GameSettings): void {
  try {
    setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[Storage] Failed to save settings:', e);
  }
}
