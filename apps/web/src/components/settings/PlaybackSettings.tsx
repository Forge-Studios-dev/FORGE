'use client';

import { useEffect, useState } from 'react';

const AUTOPLAY_KEY = 'forge.watch.autoplay';
const LOOP_KEY = 'forge.watch.loop';

function readFlag(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw === '1';
}

/** Local playback prefs shared with the watch player (same localStorage keys). */
export function PlaybackSettings() {
  const [autoplay, setAutoplay] = useState(true);
  const [loop, setLoop] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAutoplay(readFlag(AUTOPLAY_KEY, true));
    setLoop(readFlag(LOOP_KEY, false));
    setReady(true);
  }, []);

  const setPref = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    window.localStorage.setItem(key, value ? '1' : '0');
  };

  if (!ready) {
    return (
      <section id="playback" className="glass-panel mt-8 rounded-2xl p-6">
        <h2 className="font-display-forge text-lg font-semibold">Playback</h2>
        <p className="mt-2 text-sm text-on-surface-variant">Loading preferences…</p>
      </section>
    );
  }

  return (
    <section id="playback" className="glass-panel mt-8 space-y-4 rounded-2xl p-6">
      <div>
        <h2 className="font-display-forge text-lg font-semibold">Playback</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Defaults for the watch page. You can still override them on any video.
        </p>
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-on-surface">Autoplay next video</span>
          <span className="block text-xs text-on-surface-variant">
            Start the next video when one ends
          </span>
        </span>
        <input
          type="checkbox"
          checked={autoplay}
          onChange={(e) => setPref(AUTOPLAY_KEY, e.target.checked, setAutoplay)}
          className="h-4 w-4 accent-primary"
          aria-label="Autoplay next video"
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-on-surface">Loop video</span>
          <span className="block text-xs text-on-surface-variant">
            Replay the current video instead of advancing
          </span>
        </span>
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => setPref(LOOP_KEY, e.target.checked, setLoop)}
          className="h-4 w-4 accent-primary"
          aria-label="Loop video"
        />
      </label>
    </section>
  );
}
