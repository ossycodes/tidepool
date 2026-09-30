// The e2e tests get their own Postgres database and Redis index, derived
// from .env, so they never share state with the dev server (whose crons and
// queue workers would otherwise pick up test users and blogs mid-test).

/** `…/tidepool?schema=public` → `…/tidepool_e2e?schema=public` */
export function e2eDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `${url.pathname.replace(/\/$/, '')}_e2e`;
  return url.toString();
}

/** Redis database 1 instead of the default 0. */
export function e2eRedisUrl(redisUrl: string): string {
  const url = new URL(redisUrl);
  url.pathname = '/1';
  return url.toString();
}
