/**
 * Resets the database to the synthetic demo story. Idempotent: every run wipes
 * all application tables and rebuilds the same dataset (deterministic PRNG).
 *
 *   npm run seed:demo
 */
import { PrismaClient } from '@prisma/client';
import { seedDemo } from './seed/demo';

async function main() {
  const prisma = new PrismaClient();
  const started = Date.now();
  try {
    const { counts } = await seedDemo(prisma);
    console.log('R-NLAM demo dataset (SYNTHETIC, not real government records)');
    console.table(counts);
    console.log(`Seeded in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
