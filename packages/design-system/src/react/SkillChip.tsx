export function SkillChip({ skill, live }: { skill: string; live?: boolean }) {
  return (
    <div className="bg-elevated border-subtle absolute top-3 left-3 flex items-center gap-2 rounded-full border px-3 py-1">
      <span
        className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-live live-glow' : 'bg-secondary shadow-[0_0_8px_rgba(76,215,246,0.5)]'}`}
      />
      <span className="font-label-caps text-[10px] text-on-surface">{skill}</span>
    </div>
  );
}
