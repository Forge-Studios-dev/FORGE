/** Client playback preferences (YouTube-style remember last settings). */

const RATE_KEY = 'forge.watch.playbackRate';
const VOLUME_KEY = 'forge.watch.volume';
const MUTED_KEY = 'forge.watch.muted';

const ALLOWED_RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function readPreferredPlaybackRate(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = Number.parseFloat(window.localStorage.getItem(RATE_KEY) ?? '');
    if (!Number.isFinite(raw)) return 1;
    const nearest = ALLOWED_RATES.find((r) => Math.abs(r - raw) < 0.01);
    return nearest ?? 1;
  } catch {
    return 1;
  }
}

export function writePreferredPlaybackRate(rate: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RATE_KEY, String(rate));
  } catch {
    /* ignore */
  }
}

export function readPreferredVolume(): { volume: number; muted: boolean } {
  if (typeof window === 'undefined') return { volume: 1, muted: false };
  try {
    const volumeRaw = Number.parseFloat(window.localStorage.getItem(VOLUME_KEY) ?? '');
    const volume = Number.isFinite(volumeRaw) ? Math.min(1, Math.max(0, volumeRaw)) : 1;
    const muted = window.localStorage.getItem(MUTED_KEY) === '1';
    return { volume, muted };
  } catch {
    return { volume: 1, muted: false };
  }
}

export function writePreferredVolume(volume: number, muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, volume))));
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export { ALLOWED_RATES };
