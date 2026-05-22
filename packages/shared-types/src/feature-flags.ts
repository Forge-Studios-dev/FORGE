/**
 * Comma-separated feature flag lists (API: FEATURE_FLAGS, web: NEXT_PUBLIC_FEATURE_FLAGS).
 * Keep flag names lowercase snake_case.
 */
export function parseFeatureFlags(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0 && /^[a-z][a-z0-9_]*$/.test(s)),
    ),
  ];
}

export function isFeatureEnabled(flags: readonly string[], name: string): boolean {
  return flags.includes(name.trim().toLowerCase());
}
