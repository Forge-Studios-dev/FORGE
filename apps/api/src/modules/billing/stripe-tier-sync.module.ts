import { Module } from '@nestjs/common';
import { StripeTierSyncService } from './stripe-tier-sync.service';

/**
 * Standalone leaf module for StripeTierSyncService. The service only
 * depends on ConfigService (no back-reference to Billing or Entitlements),
 * so both BillingModule and EntitlementsModule can import this one-way —
 * that's what breaks the BillingModule<->EntitlementsModule circular
 * dependency (see docs/audits/FRESH_AUDIT_2026-07-26_ARCHITECTURE.md,
 * Critical #2: previously EntitlementsModule needed forwardRef(() =>
 * BillingModule) purely to reach this one leaf service).
 */
@Module({
  providers: [StripeTierSyncService],
  exports: [StripeTierSyncService],
})
export class StripeTierSyncModule {}
