'use client';

import { useMemo } from 'react';
import { extractVideoChapters } from '@/lib/description-timestamps';

const CHAPTER_LINE_RE = /^\s*((?:\d{1,2}:)?[0-5]?\d:[0-5]\d)\s+.+/gm;

/** Live preview / validation for YouTube-style chapters in a description field. */
export function DescriptionChaptersHint({ description }: { description: string }) {
  const chapterPreview = useMemo(() => extractVideoChapters(description), [description]);
  const chapterLineCount = useMemo(
    () => [...description.matchAll(new RegExp(CHAPTER_LINE_RE.source, CHAPTER_LINE_RE.flags))].length,
    [description],
  );

  return (
    <div className="mt-1.5 space-y-2">
      <p className="text-xs text-outline">
        Chapters need ≥3 timestamp lines starting at 0:00 (e.g.{' '}
        <code className="font-mono">0:00 Intro</code>).
      </p>
      {chapterPreview.length > 0 ? (
        <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
          <p className="text-xs font-semibold text-primary">
            {chapterPreview.length} chapters will show on watch
          </p>
          <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-xs text-on-surface-variant">
            {chapterPreview.map((c) => (
              <li key={`${c.seconds}-${c.title}`} className="flex gap-2 font-mono">
                <span className="shrink-0 text-outline">{c.label}</span>
                <span className="truncate font-sans">{c.title}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : chapterLineCount > 0 ? (
        <p className="text-xs text-on-surface-variant">
          {chapterLineCount < 3
            ? `Add ${3 - chapterLineCount} more timestamp line${
                3 - chapterLineCount === 1 ? '' : 's'
              } (and start at 0:00) for chapters.`
            : 'First chapter must start at 0:00 for chapters to appear.'}
        </p>
      ) : null}
    </div>
  );
}
