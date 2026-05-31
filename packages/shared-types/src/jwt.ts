/** Decode JWT payload (no signature verify — use API guards for authorization). */
export interface JwtPayloadClaims {
  sub?: string;
  email?: string;
  role?: string;
  isVerified?: boolean;
  exp?: number;
}

export function decodeJwtPayload(token: string): JwtPayloadClaims | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayloadClaims;
  } catch {
    return null;
  }
}

export function isJwtExpired(payload: JwtPayloadClaims): boolean {
  return !!payload.exp && payload.exp * 1000 < Date.now();
}
