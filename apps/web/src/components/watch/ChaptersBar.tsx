'use client';

import { useMemo } from 'react';
import type { VideoChapter } from '@/lib/description-timestamps';

export function ChaptersBar({
  chapters,
  durationSeconds,
  currentSeconds,
  onSeek,
}: {
  chapters: VideoChapter[];
  durationSeconds: number | null | undefined;
  currentSeconds: number;
  onSeek: (seconds: number) => void;
}) {
  const duration = Math.max(durationSeconds ?? 0, chapters[chapters.length - 1]?.seconds ?? 0, 1);

  const activeIndex = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < chapters.length; i += 1) {
      if (chapters[i].seconds <= currentSeconds + 0.5) idx = i;
      else break;
    }
    return idx;
  }, [chapters, currentSeconds]);

  return (
    <div className="space-y-2" role="navigation" aria-label="Chapters">
      <p className="font-label-caps text-xs text-outline">Chapters</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-container-high">
        {chapters.map((chapter, i) => {
          const next = chapters[i + 1]?.seconds ?? duration;
          const widthPct = Math.max(2, ((next - chapter.seconds) / duration) * 100);
          const active = i === activeIndex;
          return (
            <button
              key={`${chapter.seconds}-${chapter.title}`}
              type="button"
              title={`${chapter.label} ${chapter.title}`}
              aria-label={`${chapter.label} ${chapter.title}`}
              aria-current={active ? 'true' : undefined}
              onClick={() => onSeek(chapter.seconds)}
              style={{ width: `${widthPct}%` }}
              className={`h-full border-r border-background/40 transition last:border-r-0 ${
                active ? 'bg-primary' : 'bg-primary/35 hover:bg-primary/55'
              }`}
            />
          );
        })}
      </div>
      <p className="truncate text-sm text-on-surface-variant">
        <span className="font-medium text-on-surface">{chapters[activeIndex]?.title}</span>
        <span className="text-outline"> · {chapters[activeIndex]?.label}</span>
      </p>
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {chapters.map((chapter, i) => (
          <li key={`list-${chapter.seconds}-${chapter.title}`}>
            <button
              type="button"
              onClick={() => onSeek(chapter.seconds)}
              className={`flex w-full items-baseline gap-3 rounded-md px-2 py-1 text-left hover:bg-surface-container-high ${
                i === activeIndex ? 'bg-primary/10 text-primary' : 'text-on-surface-variant'
              }`}
            >
              <span className="shrink-0 font-mono text-xs text-outline">{chapter.label}</span>
              <span className="truncate">{chapter.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
