const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export type DigestFrequency = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY'

export interface User {
  id: string
  email: string
  digestEnabled: boolean
  /** 0 = Sunday ... 6 = Saturday */
  digestDay: number
  digestHour: number
  digestFrequency: DigestFrequency
  /** Hold the digest until at least this many new posts have piled up */
  digestMinPosts: number
  /** Posts mentioning any of these are left out of every digest */
  mutedKeywords: string[]
  timezone: string
  lastDigestSentAt: string | null
  /** Slug for the public /shared/:id page; null while sharing is off */
  shareId: string | null
  createdAt: string
}

export interface Post {
  id: string
  url: string
  title: string
  summary: string | null
  author: string | null
  publishedAt: string | null
  discoveredAt: string
}

export interface Blog {
  id: string
  /** The reader's own name for the blog if they set one, else the blog's title */
  title: string
  originalTitle: string
  customTitle: string | null
  /** Followed, but left out of this reader's digests */
  paused: boolean
  /** If set, only posts mentioning one of these go into digests */
  includeKeywords: string[]
  /** Posts mentioning any of these are left out of digests */
  excludeKeywords: string[]
  description: string | null
  siteUrl: string
  sourceUrl: string
  fetchMode: 'FEED' | 'SCRAPE'
  subscribedAt: string
  lastFetchedAt: string | null
  healthy: boolean
  lastError: string | null
  latestPost: Post | null
}

export interface DigestSection {
  blog: { id: string; title: string; siteUrl: string }
  posts: Post[]
}

export interface DigestPreview {
  since: string
  sections: DigestSection[]
  /** New posts left out by the reader's keyword filters */
  filtered: number
}

export type BlogPatch = {
  title?: string | null
  paused?: boolean
  includeKeywords?: string[]
  excludeKeywords?: string[]
}

/** A blog on someone's shared reading list. */
export interface SharedBlog {
  title: string
  description: string | null
  siteUrl: string
  /** The address to follow: the feed, or the page Tidepool watches */
  sourceUrl: string
  latestPost: { title: string; url: string; publishedAt: string } | null
}

export interface PublicStats {
  readers: number
  activeReaders: number
  newReadersThisWeek: number
  follows: number
  blogsPerReader: number
  blogs: number
  watchedPages: number
  postsThisWeek: number
  digestsSent: number
  digestsThisWeek: number
  lastDigestAt: string | null
  topBlogs: { title: string; siteUrl: string; followers: number }[]
  generatedAt: string
}

export interface DigestRecord {
  id: string
  sentAt: string
  postCount: number
}

export type SettingsPatch = Partial<
  Pick<
    User,
    | 'digestEnabled'
    | 'digestDay'
    | 'digestHour'
    | 'digestFrequency'
    | 'digestMinPosts'
    | 'mutedKeywords'
    | 'timezone'
  >
>

export type ImportResult =
  | { url: string; status: 'followed' | 'already'; blog: Blog }
  | { url: string; status: 'failed'; error: string }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

let getToken: () => string | null = () => null
let onUnauthorized: () => void = () => {}

/** Wired up by the session module to avoid a circular import. */
export function configureApi(options: {
  getToken: () => string | null
  onUnauthorized: () => void
}) {
  getToken = options.getToken
  onUnauthorized = options.onUnauthorized
}

/** Most requests answer in well under a second; this only catches a stuck server. */
const DEFAULT_TIMEOUT_MS = 15_000
/** Following blogs runs feed discovery, which can take a while per site. */
const DISCOVERY_TIMEOUT_MS = 90_000
/** Sending a preview waits on the mail server. */
const MAIL_TIMEOUT_MS = 45_000

/**
 * fetch with a deadline, so a server that accepts the connection but never
 * answers shows an error instead of an endless loader.
 */
async function send(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(timeoutMs) : undefined,
    })
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new ApiError(0, 'Tidepool is taking too long to respond. Try again in a moment.')
    }
    throw new ApiError(0, "Can't reach Tidepool right now. Check your connection and try again.")
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await send(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    timeoutMs,
  )

  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new ApiError(res.status, message ?? 'Something went wrong. Please try again.')
  }
  return data as T
}

async function requestText(path: string): Promise<string> {
  const token = getToken()
  const res = await send(
    path,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    DEFAULT_TIMEOUT_MS,
  )
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    throw new ApiError(res.status, 'Something went wrong. Please try again.')
  }
  return res.text()
}

export const api = {
  requestMagicLink: (email: string) =>
    request<{ ok: true }>('POST', '/auth/magic-link', { email }),
  verifyMagicLink: (token: string, timezone?: string) =>
    request<{ accessToken: string; user: User }>('POST', '/auth/verify', { token, timezone }),

  me: () => request<User>('GET', '/me'),
  updateMe: (patch: SettingsPatch) => request<User>('PATCH', '/me', patch),
  deleteMe: () => request<void>('DELETE', '/me'),
  /** Ends every session on every device, including this one. */
  signOutEverywhere: () => request<void>('POST', '/me/sign-out-everywhere'),
  shareList: (reset = false) => request<User>('POST', '/me/share', { reset }),
  stopSharing: () => request<User>('DELETE', '/me/share'),

  blogs: () => request<Blog[]>('GET', '/blogs'),
  followBlog: (url: string) =>
    request<Blog>('POST', '/blogs', { url }, DISCOVERY_TIMEOUT_MS),
  unfollowBlog: (id: string) => request<void>('DELETE', `/blogs/${encodeURIComponent(id)}`),
  importBlogs: (urls: string[]) =>
    request<ImportResult[]>('POST', '/blogs/batch', { urls }, DISCOVERY_TIMEOUT_MS),
  exportOpml: () => requestText('/blogs/export.opml'),
  updateBlog: (id: string, patch: BlogPatch) =>
    request<Blog>('PATCH', `/blogs/${encodeURIComponent(id)}`, patch),
  blogPosts: (id: string, limit = 5) =>
    request<Post[]>('GET', `/blogs/${encodeURIComponent(id)}/posts?limit=${limit}`),

  digestPreview: () => request<DigestPreview>('GET', '/digests/preview'),
  digestHistory: () => request<DigestRecord[]>('GET', '/digests'),
  sendTestDigest: () =>
    request<{ sent: boolean; postCount: number }>(
      'POST',
      '/digests/test',
      undefined,
      MAIL_TIMEOUT_MS,
    ),

  publicStats: () => request<PublicStats>('GET', '/stats'),
  sharedList: (id: string) =>
    request<{ blogs: SharedBlog[] }>('GET', `/shared/${encodeURIComponent(id)}`),
}

export interface ReadingState {
  saved: boolean;
  favourite: boolean;
  status: 'UNREAD' | 'READING' | 'READ';
  progress: number;
  paragraph: string | null;
  collections: { id: string; name: string }[];
}
export interface Collection {
  id: string;
  name: string;
  count: number;
}
export interface LibraryItem extends Post {
  blogTitle: string;
  readingTime: number | null;
  state: ReadingState;
}
export interface Annotation {
  id: string;
  paragraph: string | null;
  quote: string;
  start: number;
  end: number;
  prefix: string;
  suffix: string;
  version: string;
  note: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}
export interface ReaderArticle extends Post {
  blog: { title: string; siteUrl: string };
  state: ReadingState | null;
  content: {
    html: string;
    text: string;
    version: string;
    readingTime: number;
  } | null;
  annotations: Annotation[];
  extraction: 'idle' | 'pending' | 'failed' | 'ready';
  aiEnabled: boolean;
}
export const libraryApi = {
  list: () =>
    request<{ items: LibraryItem[]; collections: Collection[] }>(
      'GET',
      '/library',
    ),
  read: (id: string) =>
    request<ReaderArticle>('GET', `/library/posts/${encodeURIComponent(id)}`),
  extract: (id: string) =>
    request('POST', `/library/posts/${encodeURIComponent(id)}/extract`),
  update: (
    id: string,
    patch: Partial<Omit<ReadingState, 'collections' | 'paragraph'>> & {
      paragraph?: string | null;
      collectionIds?: string[];
    },
  ) =>
    request<ReadingState>(
      'PATCH',
      `/library/posts/${encodeURIComponent(id)}`,
      patch,
    ),
  collection: (name: string) =>
    request<Collection>('POST', '/library/collections', { name }),
  deleteCollection: (id: string) =>
    request<void>('DELETE', `/library/collections/${encodeURIComponent(id)}`),
  annotate: (
    id: string,
    anchor: {
      paragraph: string;
      quote: string;
      start: number;
      end: number;
      version: string;
      note?: string;
    },
  ) =>
    request<Annotation>(
      'POST',
      `/library/posts/${encodeURIComponent(id)}/notes`,
      anchor,
    ),
  note: (id: string, note: string) =>
    request<void>('PATCH', `/library/notes/${encodeURIComponent(id)}`, {
      note,
    }),
  deleteNote: (id: string) =>
    request<void>('DELETE', `/library/notes/${encodeURIComponent(id)}`),
  async ask(
    id: string,
    body: { question: string; annotationId?: string; mode: 'quick' | 'deep' },
    onEvent: (event: string, data: unknown) => void,
    signal: AbortSignal,
  ) {
    const token = getToken();
    const res = await fetch(
      `${BASE_URL}/library/posts/${encodeURIComponent(id)}/ask`,
      {
        method: 'POST',
        signal: AbortSignal.any([signal, AbortSignal.timeout(70_000)]),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      if (res.status === 401 && token) onUnauthorized();
      const data = await res.json().catch(() => null);
      throw new ApiError(
        res.status,
        data?.message ?? 'Could not start the answer.',
      );
    }
    if (!res.body) throw new Error('Streaming is unavailable in this browser.');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '',
      completed = false;
    try {
      while (true) {
        const result = await reader.read();
        buffer += decoder.decode(result.value, { stream: !result.done });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const block of events) {
          const event = block.match(/^event: (.+)$/m)?.[1];
          const data = block.match(/^data: (.+)$/m)?.[1];
          if (!event || !data) continue;
          const parsed = JSON.parse(data);
          if (event === 'error') throw new Error(parsed.message);
          if (event === 'done') completed = true;
          onEvent(event, parsed);
        }
        if (result.done) break;
      }
      if (!completed)
        throw new Error('The answer was interrupted. Please try again.');
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  },
};
