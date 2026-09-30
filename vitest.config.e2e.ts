import 'dotenv/config';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { e2eDatabaseUrl, e2eRedisUrl } from './test/e2e-env.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    exclude: ['**/node_modules/**', 'web/**'],
    // Isolated from the dev database and Redis (see test/e2e-env.ts). These
    // win over .env because @nestjs/config never overrides process.env.
    env: {
      DATABASE_URL: e2eDatabaseUrl(process.env.DATABASE_URL ?? ''),
      REDIS_URL: e2eRedisUrl(process.env.REDIS_URL ?? ''),
    },
    globalSetup: './test/global-setup.ts',
  },
});
