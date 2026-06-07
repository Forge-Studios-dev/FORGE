'use client';

import { useEffect, useState } from 'react';

/** Approximate metadata block below 16:9 thumbnail (title, creator, stats). */
const FEED_CARD_META_PX = 92;

function readFeedColumns(): number {
  if (typeof window === 'undefined') return 2;
  if (window.matchMedia('(min-width: 1280px)').matches) return 4;
  if (window.matchMedia('(min-width: 1024px)').matches) return 3;
  if (window.matchMedia('(min-width: 640px)').matches) return 2;
  return 1;
}

/** Match FeedGrid Tailwind breakpoints: 1 / 2 / 3 / 4 columns. */
export function useFeedColumns(): number {
  const [cols, setCols] = useState(readFeedColumns);

  useEffect(() => {
    const update = () => setCols(readFeedColumns());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return cols;
}

export function chunkFeedRows<T>(items: T[], columnCount: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columnCount) {
    rows.push(items.slice(i, i + columnCount));
  }
  return rows;
}

/** Row height estimate for virtualized feed (16:9 thumb + metadata). */
export function estimateFeedRowHeight(columnCount: number, viewportWidth?: number): number {
  const width = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const horizontalPad = width >= 768 ? 96 : 40;
  const gap = 16;
  const colWidth = Math.max(160, (width - horizontalPad * 2 - gap * (columnCount - 1)) / columnCount);
  const thumbHeight = colWidth * (9 / 16);
  return Math.ceil(thumbHeight + FEED_CARD_META_PX);
}
