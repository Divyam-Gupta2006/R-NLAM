import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { seedDemo } from '../prisma/seed/demo';
import { testDatabaseUrl, withDatabase } from './test-db';

/** Create `<db>_test` if needed, migrate it, and load the demo story. */
export default async function globalSetup() {
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
  const url = testDatabaseUrl();
  const dbName = new URL(url).pathname.slice(1);

  const admin = new PrismaClient({ datasources: { db: { url: withDatabase(url, 'postgres') } } });
  const exists = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await admin.$disconnect();

  execSync('npx prisma migrate deploy', { cwd: path.join(__dirname, '..'), env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  await seedDemo(prisma);
  await prisma.$disconnect();
}
