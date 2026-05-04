import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { seedCategories } from './categories.seed';

async function runSeeds() {
  await AppDataSource.initialize();
  console.log('Database connected. Running seeds...');
  await seedCategories(AppDataSource);
  await AppDataSource.destroy();
  console.log('All seeds complete.');
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
