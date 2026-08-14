import { permanentRedirect } from 'next/navigation';

/**
 * Old handles still resolve via API username_history; send clients to the
 * canonical `/{username}` so bookmarks update (YouTube-style rename redirect).
 */
export function redirectIfStaleProfileUsername(
  pathUsername: string,
  canonicalUsername: string,
  suffix = '',
): void {
  if (pathUsername.toLowerCase() === canonicalUsername.toLowerCase()) return;
  permanentRedirect(`/${canonicalUsername}${suffix}`);
}
