const STORAGE_KEY = 'forge.watchHistory.paused';

export function isWatchHistoryPaused(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setWatchHistoryPaused(paused: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (paused) {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore quota / private mode */
  }
}
