'use client';

import { useEffect, useState } from 'react';

/** Match FeedGrid Tailwind breakpoints: 1 / 2 / 3 / 4 columns. */
export function useFeedColumns(): number {
  const [cols, setCols] = useState(1);

  useEffect(() => {
    const update = () => {
      if (window.matchMedia('(min-width: 1280px)').matches) setCols(4);
      else if (window.matchMedia('(min-width: 1024px)').matches) setCols(3);
      else if (window.matchMedia('(min-width: 640px)').matches) setCols(2);
      else setCols(1);
    };
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
