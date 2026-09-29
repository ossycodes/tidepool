import { Global, Injectable, Module } from '@nestjs/common';
import { safeFetch, type FetchResult } from './safe-fetch.js';

export const ACCEPT_FEED =
  'application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.5';
export const ACCEPT_HTML = 'text/html, application/xhtml+xml, */*;q=0.8';

/** Injectable wrapper around safeFetch so tests can swap out the network. */
@Injectable()
export class HttpClient {
  get(url: string, accept = ACCEPT_HTML): Promise<FetchResult> {
    return safeFetch(url, accept);
  }
}

@Global()
@Module({
  providers: [HttpClient],
  exports: [HttpClient],
})
export class HttpClientModule {}
