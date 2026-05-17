export function LiveBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-label-caps inline-flex items-center gap-1.5 rounded-full bg-live px-2.5 py-0.5 text-[10px] text-white live-glow ${className}`}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      LIVE
    </span>
  );
}
