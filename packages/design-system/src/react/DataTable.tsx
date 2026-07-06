'use client';

import { useState, type ReactNode } from 'react';
import type { ColumnDef, RowSelectionState, SortingState } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { Icon } from './Icon';
import { EmptyState } from './EmptyState';
import { SkeletonBlock } from './LoadingSkeleton';

/**
 * Shared data table: sortable columns, optional row-select with a bulk-action bar,
 * and required loading/empty/error slots so every consumer designs those states
 * instead of leaving them to chance.
 */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  loading = false,
  error,
  emptyState,
  selectable = false,
  bulkActions,
  onSelectionChange,
  rowCount,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  getRowId?: (row: T) => string;
  loading?: boolean;
  error?: { title: string; description?: string; onRetry?: () => void };
  emptyState?: { title: string; description?: string };
  selectable?: boolean;
  /** Rendered in the bulk-action bar while >=1 row is selected. Receives the selected row objects. */
  bulkActions?: (selectedRows: T[]) => ReactNode;
  onSelectionChange?: (selectedRows: T[]) => void;
  rowCount?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    getRowId,
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(next);
      if (onSelectionChange) {
        const ids = Object.keys(next).filter((id) => next[id]);
        const rows = table.getCoreRowModel().rows.filter((r) => ids.includes(r.id)).map((r) => r.original);
        onSelectionChange(rows);
      }
    },
    enableRowSelection: selectable,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const selectedRows = table.getRowModel().rows.filter((r) => selectedIds.includes(r.id)).map((r) => r.original);
  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  if (error) {
    return (
      <EmptyState
        icon="error"
        title={error.title}
        description={error.description}
        {...(error.onRetry ? { onAction: error.onRetry, action: { label: 'Retry', href: '#' } } : {})}
      />
    );
  }

  if (!loading && data.length === 0) {
    return <EmptyState icon="inbox" title={emptyState?.title ?? 'Nothing here yet'} description={emptyState?.description} />;
  }

  return (
    <div className="rounded-xl border border-subtle bg-surface-container-low">
      {selectable && selectedIds.length > 0 ? (
        <div className="flex items-center gap-3 border-b border-subtle bg-surface-container-high px-4 py-2.5">
          <span className="font-label-caps text-on-surface-variant">{selectedIds.length} selected</span>
          <div className="ml-auto flex items-center gap-2">{bulkActions?.(selectedRows)}</div>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {selectable ? (
                  <th className="w-10 border-b border-subtle px-4 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={table.getToggleAllRowsSelectedHandler()}
                      className="h-4 w-4 rounded border-outline-variant accent-primary"
                    />
                  </th>
                ) : null}
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="border-b border-subtle px-4 py-2.5 text-left font-label-caps text-on-surface-variant"
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        disabled={!header.column.getCanSort()}
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 disabled:cursor-default"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? <Icon name="arrow_upward" className="text-xs" /> : null}
                        {header.column.getIsSorted() === 'desc' ? <Icon name="arrow_downward" className="text-xs" /> : null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: rowCount ?? 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-3">
                      <SkeletonBlock className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className="border-b border-subtle transition-colors last:border-b-0 hover:bg-surface-container-high/60 data-[state=selected]:bg-primary/10"
                  >
                    {selectable ? (
                      <td className="w-10 px-4 py-2.5">
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          checked={row.getIsSelected()}
                          onChange={row.getToggleSelectedHandler()}
                          className="h-4 w-4 rounded border-outline-variant accent-primary"
                        />
                      </td>
                    ) : null}
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5 text-on-surface">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
