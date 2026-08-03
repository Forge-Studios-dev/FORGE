/** Playlist playback prefs when watching with ?list= */

const LOOP_PLAYLIST_KEY = 'forge.watch.loopPlaylist';

export function readLoopPlaylistPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LOOP_PLAYLIST_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeLoopPlaylistPreference(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOOP_PLAYLIST_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Stable-ish pick among candidates for shuffle “up next” (changes when currentId changes). */
export function pickShuffledNextId(
  videoIds: string[],
  currentId: string,
  listId: string,
): string | null {
  const others = videoIds.filter((id) => id !== currentId);
  if (others.length === 0) return null;
  let hash = 0;
  const seed = `${listId}:${currentId}`;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return others[hash % others.length] ?? null;
}

export function buildWatchListHref(
  videoId: string,
  listId: string | null,
  shuffle: boolean,
): string {
  if (!listId) return `/watch/${videoId}`;
  const params = new URLSearchParams();
  params.set('list', listId);
  if (shuffle) params.set('shuffle', '1');
  return `/watch/${videoId}?${params.toString()}`;
}
