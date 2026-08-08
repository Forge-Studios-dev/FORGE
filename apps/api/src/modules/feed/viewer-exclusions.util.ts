/** Union of creator IDs to hide from a viewer (muted + blocked peers). */
export function mergeExcludedCreatorIds(...lists: Array<string[] | undefined | null>): string[] {
  const ids = new Set<string>();
  for (const list of lists) {
    if (!list?.length) continue;
    for (const id of list) {
      if (id) ids.add(id);
    }
  }
  return [...ids];
}
