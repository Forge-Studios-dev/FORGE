/**
 * Generate cheap 1-edit prefix candidates for search suggest when exact
 * prefix / contains matches are sparse. Caps variants to keep the ILIKE
 * OR-clause bounded (no pg_trgm required).
 */
export function suggestTypoPrefixes(term: string, max = 8): string[] {
  const t = term.trim().toLowerCase();
  if (t.length < 3) return [];

  const out = new Set<string>();

  for (let i = 0; i < t.length; i++) {
    const deleted = t.slice(0, i) + t.slice(i + 1);
    if (deleted.length >= 2) out.add(deleted);
  }

  for (let i = 0; i < t.length - 1; i++) {
    const chars = [...t];
    const tmp = chars[i];
    chars[i] = chars[i + 1];
    chars[i + 1] = tmp;
    out.add(chars.join(''));
  }

  out.delete(t);
  return [...out].slice(0, max);
}
