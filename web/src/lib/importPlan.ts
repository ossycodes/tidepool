// How an import is split into requests to POST /blogs/batch.

/** Matches the API's IMPORT_BATCH_SIZE. */
const MAX_BATCH = 10
/** Blogs being discovered at once; the API follows up to 5 per request. */
const MAX_IN_FLIGHT = 10

/**
 * Splits an import into requests. Small imports go one blog per request (in
 * parallel) so progress ticks as each blog lands; big ones use full batches
 * to stay well inside the API's rate limit.
 */
export function planBatches(urls: string[]): { batches: string[][]; parallel: number } {
  const size = Math.min(MAX_BATCH, Math.max(1, Math.ceil(urls.length / 5)))
  const batches: string[][] = []
  for (let i = 0; i < urls.length; i += size) batches.push(urls.slice(i, i + size))
  const parallel = Math.max(1, Math.min(5, Math.floor(MAX_IN_FLIGHT / size)))
  return { batches, parallel }
}
