'use client';

import { useState } from 'react';
import { Button, Input } from '@forge/design-system';
import {
  applyChapterRowsToDescription,
  type ChapterDraftRow,
  listChapterDraftRows,
} from '@/lib/description-timestamps';
import { DescriptionChaptersHint } from './DescriptionChaptersHint';

const EMPTY_ROWS: ChapterDraftRow[] = [
  { time: '0:00', title: '' },
  { time: '', title: '' },
  { time: '', title: '' },
];

/** Structured chapter rows that rewrite YouTube-style timestamp lines in the description. */
export function DescriptionChaptersEditor({
  description,
  onDescriptionChange,
}: {
  description: string;
  onDescriptionChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ChapterDraftRow[]>(EMPTY_ROWS);

  const openEditor = () => {
    const parsed = listChapterDraftRows(description);
    setRows(parsed.length > 0 ? parsed : EMPTY_ROWS.map((r) => ({ ...r })));
    setOpen(true);
  };

  const updateRow = (index: number, patch: Partial<ChapterDraftRow>) => {
    setRows((prev) => {
      const next = prev.map((row, i) => (i === index ? { ...row, ...patch } : row));
      onDescriptionChange(applyChapterRowsToDescription(description, next));
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, { time: '', title: '' }]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const ensured = next.length > 0 ? next : EMPTY_ROWS.map((r) => ({ ...r }));
      onDescriptionChange(applyChapterRowsToDescription(description, ensured));
      return ensured;
    });
  };

  const clearChapters = () => {
    setRows(EMPTY_ROWS.map((r) => ({ ...r })));
    onDescriptionChange(applyChapterRowsToDescription(description, []));
  };

  return (
    <div className="mt-1.5 space-y-2">
      <DescriptionChaptersHint description={description} />
      <button
        type="button"
        className="text-xs font-semibold text-primary hover:underline"
        onClick={() => {
          if (open) setOpen(false);
          else openEditor();
        }}
      >
        {open ? 'Hide chapter editor' : 'Edit chapters'}
      </button>
      {open ? (
        <div className="space-y-2 rounded-xl border border-outline-variant/40 bg-surface-container-low/60 p-3">
          <p className="text-xs text-on-surface-variant">
            Rows write timestamp lines into the description (≥3 starting at 0:00 to show on watch).
          </p>
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <Input
                  className="w-24 font-mono text-sm"
                  value={row.time}
                  placeholder="0:00"
                  aria-label={`Chapter ${index + 1} time`}
                  onChange={(e) => updateRow(index, { time: e.target.value })}
                />
                <Input
                  className="min-w-[10rem] flex-1 text-sm"
                  value={row.title}
                  placeholder="Chapter title"
                  aria-label={`Chapter ${index + 1} title`}
                  onChange={(e) => updateRow(index, { title: e.target.value })}
                />
                <button
                  type="button"
                  className="text-xs text-on-surface-variant hover:text-error"
                  onClick={() => removeRow(index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" className="text-sm" onClick={addRow}>
              Add chapter
            </Button>
            <Button type="button" variant="ghost" className="text-sm" onClick={clearChapters}>
              Clear chapters
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
