/**
 * Generate cheap 1-edit prefix candidates for search suggest when exact
 * prefix / contains matches are sparse. Caps variants to keep the ILIKE
 * OR-clause bounded (no pg_trgm required).
 */
export function suggestTypoPrefixes(term: string, max = 8): string[] {
  const raw = typeof term === 'string' ? term.trim().toLowerCase() : '';
  // Bound loop iterations — CodeQL js/loop-bound-injection (user query string).
  const t = raw.slice(0, 64);
  if (t.length < 3) return [];

  const out = new Set<string>();
  const n = t.length;

  for (let i = 0; i < n; i++) {
    const deleted = t.slice(0, i) + t.slice(i + 1);
    if (deleted.length >= 2) out.add(deleted);
  }

  for (let i = 0; i < n - 1; i++) {
    const chars = [...t];
    const tmp = chars[i];
    chars[i] = chars[i + 1];
    chars[i + 1] = tmp;
    out.add(chars.join(''));
  }

  out.delete(t);
  return [...out].slice(0, Math.max(0, Math.min(max, 32)));
}
