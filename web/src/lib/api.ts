const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export interface User {
  id: string
  email: string
  digestEnabled: boolean
  /** 0 = Sunday ... 6 = Saturday */
  digestDay: number
  digestHour: number
  timezone: string
  lastDigestSentAt: string | null
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
  Pick<User, 'digestEnabled' | 'digestDay' | 'digestHour' | 'timezone'>
>

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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, "Can't reach Tidepool right now. Check your connection and try again.")
  }

  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null

  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message
    throw new ApiError(res.status, message ?? 'Something went wrong. Please try again.')
  }
  return data as T
}

export const api = {
  requestMagicLink: (email: string) =>
    request<{ ok: true }>('POST', '/auth/magic-link', { email }),
  verifyMagicLink: (token: string, timezone?: string) =>
    request<{ accessToken: string; user: User }>('POST', '/auth/verify', { token, timezone }),

  me: () => request<User>('GET', '/me'),
  updateMe: (patch: SettingsPatch) => request<User>('PATCH', '/me', patch),
  deleteMe: () => request<void>('DELETE', '/me'),

  blogs: () => request<Blog[]>('GET', '/blogs'),
  followBlog: (url: string) => request<Blog>('POST', '/blogs', { url }),
  unfollowBlog: (id: string) => request<void>('DELETE', `/blogs/${encodeURIComponent(id)}`),
  updateBlog: (id: string, patch: { title?: string | null; paused?: boolean }) =>
    request<Blog>('PATCH', `/blogs/${encodeURIComponent(id)}`, patch),
  blogPosts: (id: string, limit = 5) =>
    request<Post[]>('GET', `/blogs/${encodeURIComponent(id)}/posts?limit=${limit}`),

  digestPreview: () => request<DigestPreview>('GET', '/digests/preview'),
  digestHistory: () => request<DigestRecord[]>('GET', '/digests'),
  sendTestDigest: () => request<{ sent: boolean; postCount: number }>('POST', '/digests/test'),

  publicStats: () => request<PublicStats>('GET', '/stats'),
}
