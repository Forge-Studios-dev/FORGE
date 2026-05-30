export {
  MAX_RETURN_PATH_LEN,
  safeReturnPath,
  loginHrefWithNext,
} from '@forge/shared-types/safe-return-path';

/** Current location as return path (pathname + search). */
export function currentReturnPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search;
}
