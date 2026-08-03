'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { parseWebVtt, type VttCue } from '@/lib/webvtt';
import { formatDuration } from '@/lib/utils';

type CaptionTrack = { language: string; label: string; url: string };

export function TranscriptPanel({
  videoId,
  captionUrl,
  captionTracks,
  currentSeconds,
  onSeek,
}: {
  videoId: string;
  captionUrl?: string | null;
  captionTracks?: CaptionTrack[] | null;
  currentSeconds: number;
  onSeek: (seconds: number) => void;
}) {
  const tracks: CaptionTrack[] =
    captionTracks && captionTracks.length > 0
      ? captionTracks
      : captionUrl
        ? [{ language: 'en', label: 'English', url: captionUrl }]
        : [];

  const [trackLang, setTrackLang] = useState('');
  const [open, setOpen] = useState(false);
  const firstLang = tracks[0]?.language ?? '';

  useEffect(() => {
    setTrackLang(firstLang);
    setOpen(false);
  }, [videoId, firstLang]);

  const activeLang = trackLang || firstLang;

  const { data: cues = [], isLoading, isError } = useQuery({
    queryKey: ['transcript', videoId, activeLang],
    enabled: open && !!videoId && !!activeLang,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: { text: string } }>(
        `/videos/${videoId}/captions`,
        { params: { language: activeLang } },
      );
      return parseWebVtt(data.data.text);
    },
  });

  const activeIndex = useMemo(() => {
    if (!cues.length) return -1;
    let idx = -1;
    for (let i = 0; i < cues.length; i += 1) {
      if (cues[i].startSeconds <= currentSeconds + 0.25) idx = i;
      else break;
    }
    return idx;
  }, [cues, currentSeconds]);

  if (!tracks.length) return null;

  return (
    <div className="glass-panel rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-sm font-semibold text-primary hover:underline"
          aria-expanded={open}
        >
          {open ? 'Hide transcript' : 'Show transcript'}
        </button>
        {open && tracks.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-on-surface-variant">
            Language
            <select
              value={activeLang}
              onChange={(e) => setTrackLang(e.target.value)}
              className="rounded-md border border-outline-variant/40 bg-surface-container-low px-2 py-1 text-sm text-on-surface"
            >
              {tracks.map((t) => (
                <option key={`${t.language}-${t.url}`} value={t.language}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {open ? (
        <div className="mt-4 max-h-72 overflow-y-auto pr-1" role="list" aria-label="Transcript">
          {isLoading ? (
            <p className="text-sm text-on-surface-variant">Loading transcript…</p>
          ) : isError ? (
            <p className="text-sm text-error">Could not load captions for this video.</p>
          ) : !cues.length ? (
            <p className="text-sm text-on-surface-variant">No cue text found in this track.</p>
          ) : (
            <ul className="space-y-1">
              {cues.map((cue: VttCue, i) => {
                const active = i === activeIndex;
                return (
                  <li key={`${cue.startSeconds}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onSeek(cue.startSeconds)}
                      className={`flex w-full gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-container-high ${
                        active ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      <span className="w-12 shrink-0 font-mono text-xs text-outline">
                        {formatDuration(Math.floor(cue.startSeconds))}
                      </span>
                      <span className="min-w-0 flex-1">{cue.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
