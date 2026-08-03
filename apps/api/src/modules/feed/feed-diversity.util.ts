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
