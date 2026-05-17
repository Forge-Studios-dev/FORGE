'use client';

export function AdminPagination({
  page,
  totalPages,
  total,
  label,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  total: number;
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-outline-variant/20 px-4 py-3 text-sm text-on-surface-variant">
      <span>
        Page {page} of {totalPages} · {total} {label}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="rounded-lg border border-outline-variant px-3 py-1 hover:border-primary disabled:opacity-40"
        >
          Prev
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="rounded-lg border border-outline-variant px-3 py-1 hover:border-primary disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
