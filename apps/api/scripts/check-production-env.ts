/**
 * Formal production-readiness env gate.
 *
 * Runs the SAME authoritative validator the API uses at boot
 * (`validateProductionEnv`) so a pre-deploy/CI check can never diverge from what
 * the running app will accept. Exits non-zero with aggregated errors on failure.
 *
 * Usage: NODE_ENV=production ts-node scripts/check-production-env.ts
 */
import { validateProductionEnv } from '../src/config/env-production.schema';

function main(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  try {
    validateProductionEnv(process.env);
    if (nodeEnv === 'production') {
      console.log('OK: production environment validation passed');
    } else {
      console.log(`OK: NODE_ENV=${nodeEnv} — production validation skipped`);
    }
    process.exit(0);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

main();
