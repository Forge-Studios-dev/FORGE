import { decodeJwtPayload, isJwtExpired } from './jwt';

/** Consumer site session cookie must not carry platform-admin JWTs. */
export function isValidConsumerAccessToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || isJwtExpired(payload)) return false;
  if (payload.role === 'admin') return false;
  return true;
}

/** Upload flows (except become-creator) require creator role in access JWT. */
export function accessTokenAllowsCreatorUpload(token: string | undefined | null): boolean {
  if (!isValidConsumerAccessToken(token)) return false;
  const payload = decodeJwtPayload(token!);
  return payload?.role === 'creator';
}

/** Creator upload/live paths require verified email in access JWT. */
export function accessTokenIsEmailVerified(token: string | undefined | null): boolean {
  if (!isValidConsumerAccessToken(token)) return false;
  const payload = decodeJwtPayload(token!);
  return payload?.isVerified === true;
}
