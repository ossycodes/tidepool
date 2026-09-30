// Keyword filters: readers can mute words everywhere, and per blog only
// include (or leave out) posts that mention certain words. Matching is
// case-insensitive on whole words or phrases in the title and summary, so
// "AI" doesn't match "said".

export const MAX_KEYWORDS = 20;
export const MAX_KEYWORD_LENGTH = 50;

/** Trims, collapses spaces, drops blanks and case-insensitive duplicates. */
export function normalizeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keywords) {
    const keyword = raw.trim().replace(/\s+/g, ' ');
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    out.push(keyword);
  }
  return out.slice(0, MAX_KEYWORDS);
}

function pattern(keyword: string): RegExp {
  const escaped = keyword
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/ /g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu');
}

export interface KeywordRules {
  /** Muted everywhere (the reader's settings) */
  muted: string[];
  /** This blog: if set, only posts mentioning one of these */
  include: string[];
  /** This blog: posts mentioning any of these are left out */
  exclude: string[];
}

/** Returns a test for whether a post passes the reader's filters. */
export function keywordFilter(rules: KeywordRules) {
  const block = [...rules.muted, ...rules.exclude].map(pattern);
  const need = rules.include.map(pattern);
  return (post: { title: string; summary: string | null }): boolean => {
    const text = `${post.title}\n${post.summary ?? ''}`;
    if (block.some((re) => re.test(text))) return false;
    return need.length === 0 || need.some((re) => re.test(text));
  };
}
