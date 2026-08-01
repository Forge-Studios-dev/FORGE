/**
 * Profile slug rules — must stay aligned with SignupDto username Matches:
 * letters, numbers, underscores; 3–30 chars.
 */
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

/** True when the path segment is a plausible profile username (not favicon.ico, etc.). */
export function isValidProfileUsername(username: string | undefined | null): boolean {
  if (!username) return false;
  return USERNAME_RE.test(username);
}
