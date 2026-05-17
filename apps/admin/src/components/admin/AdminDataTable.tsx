'use client';

import type { ReactNode } from 'react';

export function AdminDataTable({
  headers,
  children,
  footer,
  isLoading,
  colCount,
  emptyMessage,
  isEmpty,
}: {
  headers: string[];
  children: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
  colCount: number;
  emptyMessage?: string;
  isEmpty?: boolean;
}) {
  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 bg-surface-container-high/50">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-label-caps text-xs text-outline uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: colCount }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-surface-container-high" />
                      </td>
                    ))}
                  </tr>
                ))
              : isEmpty
                ? (
                    <tr>
                      <td colSpan={colCount} className="px-4 py-10 text-center text-on-surface-variant">
                        {emptyMessage ?? 'No results'}
                      </td>
                    </tr>
                  )
                : children}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
