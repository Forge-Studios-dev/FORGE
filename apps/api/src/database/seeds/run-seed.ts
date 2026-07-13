import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedCategories } from './categories.seed';
import { seedDemoUsers } from './demo-users.seed';

/** Mirrors the production-marker guard in scripts/wipe-platform-data.sh */
const PROD_DB_MARKERS = ['neon.tech', 'forgestudios.net', 'production'];

function isProductionLikeDatabase(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null;
  return PROD_DB_MARKERS.find((marker) => databaseUrl.includes(marker)) ?? null;
}

function assertDemoSeedAllowed() {
  const matchedMarker = isProductionLikeDatabase(process.env.DATABASE_URL);
  if (process.env.NODE_ENV === 'production' || matchedMarker) {
    if (process.env.FORGE_SEED_ALLOW_PRODUCTION !== 'yes') {
      const reason =
        process.env.NODE_ENV === 'production'
          ? 'NODE_ENV=production'
          : `DATABASE_URL looks like production (matched: ${matchedMarker})`;
      console.error(
        `ERROR: Refusing to seed demo accounts — ${reason}.\n` +
          '  Demo users ship a publicly-known password and must never exist in production.\n' +
          '  To override (not recommended): FORGE_SEED_ALLOW_PRODUCTION=yes npm run seed --workspace=apps/api',
      );
      process.exit(1);
    }
  }
}

async function runSeeds() {
  await AppDataSource.initialize();
  console.log('Database connected. Running seeds...');
  await seedCategories(AppDataSource);
  if (process.env.FORGE_SEED_DEMO !== '0') {
    assertDemoSeedAllowed();
    await seedDemoUsers(AppDataSource);
  }
  await AppDataSource.destroy();
  console.log('All seeds complete.');
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
