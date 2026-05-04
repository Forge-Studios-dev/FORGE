/**
 * Re-export shared contracts between API, web, admin, and tooling.
 * Add DTO mirrors, API response shapes, and enums here as they stabilize.
 */

export type HealthStatus = 'ok' | 'degraded';

export interface HealthPayload {
  status: HealthStatus;
  timestamp: string;
}
