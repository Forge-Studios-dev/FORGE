/**
 * Soft diversity: prefer at most `maxPerCreator` videos from the same channel
 * early in the list; extras are appended so pagination length is preserved.
 */
export function diversifyByCreator<T extends { userId: string }>(
  items: T[],
  maxPerCreator = 2,
): T[] {
  if (items.length <= 2 || maxPerCreator < 1) return items;
  const counts = new Map<string, number>();
  const primary: T[] = [];
  const deferred: T[] = [];
  for (const item of items) {
    const n = counts.get(item.userId) ?? 0;
    if (n < maxPerCreator) {
      primary.push(item);
      counts.set(item.userId, n + 1);
    } else {
      deferred.push(item);
    }
  }
  return deferred.length ? [...primary, ...deferred] : primary;
}

/**
 * Weave cold-start / exploration candidates into an affinity-ranked feed.
 * Replaces ~`ratio` of slots after `skipFirst` so creator discovery isn't
 * trapped in the viewer's existing follow/category bubble (YouTube-like).
 */
export function applyExplorationBudget<T extends { id: string }>(
  primary: T[],
  exploration: T[],
  opts?: { ratio?: number; skipFirst?: number },
): T[] {
  const ratio = Math.min(0.35, Math.max(0, opts?.ratio ?? 0.15));
  const skipFirst = Math.max(0, opts?.skipFirst ?? 3);
  if (!exploration.length || primary.length <= skipFirst) return primary;

  const seen = new Set(primary.map((p) => p.id));
  const pool = exploration.filter((e) => !seen.has(e.id));
  if (!pool.length) return primary;

  const out = [...primary];
  const slots = Math.max(1, Math.floor(out.length * ratio));
  const span = Math.max(1, out.length - skipFirst);
  const spacing = Math.max(3, Math.floor(span / slots));
  let pi = 0;
  for (let s = 0; s < slots && pi < pool.length; s++) {
    const idx = skipFirst + s * spacing;
    if (idx >= out.length) break;
    out[idx] = pool[pi++];
  }
  return out;
}
