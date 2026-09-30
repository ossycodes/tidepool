import 'dotenv/config';
import { execSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { e2eDatabaseUrl } from './e2e-env.js';

/**
 * Runs once before the e2e suite: creates the separate e2e database if it
 * doesn't exist yet and applies every migration to it.
 */
export default async function setup() {
  const devUrl = process.env.DATABASE_URL;
  if (!devUrl) throw new Error('DATABASE_URL is missing from .env');
  const testUrl = e2eDatabaseUrl(devUrl);
  const name = new URL(testUrl).pathname.slice(1);

  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: devUrl }),
  });
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${name}) AS "exists"`;
    if (!rows[0]?.exists) {
      // Identifiers can't be bound as parameters; the name comes from .env.
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });
}
