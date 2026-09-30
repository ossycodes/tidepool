import { keywordFilter, normalizeKeywords } from './keywords.js';

const post = (title: string, summary: string | null = null) => ({
  title,
  summary,
});

describe('normalizeKeywords', () => {
  it('trims, collapses spaces and drops blanks and duplicates', () => {
    expect(
      normalizeKeywords(['  Rust ', 'rust', '', 'machine   learning', '  ']),
    ).toEqual(['Rust', 'machine learning']);
  });

  it('keeps at most 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => `word${i}`);
    expect(normalizeKeywords(many)).toHaveLength(20);
  });
});

describe('keywordFilter', () => {
  const none = { muted: [], include: [], exclude: [] };

  it('keeps everything without rules', () => {
    expect(keywordFilter(none)(post('Anything'))).toBe(true);
  });

  it('mutes whole words in the title or summary, ignoring case', () => {
    const keep = keywordFilter({ ...none, muted: ['crypto'] });
    expect(keep(post('Why CRYPTO is back'))).toBe(false);
    expect(keep(post('A post', 'All about crypto markets'))).toBe(false);
    expect(keep(post('Cryptography basics'))).toBe(true);
  });

  it('matches whole words only, so AI does not match "said"', () => {
    const keep = keywordFilter({ ...none, exclude: ['AI'] });
    expect(keep(post('She said hello'))).toBe(true);
    expect(keep(post('What AI means for writers'))).toBe(false);
    expect(keep(post('Notes on A.I.'))).toBe(true);
  });

  it('matches phrases across extra spaces', () => {
    const keep = keywordFilter({ ...none, exclude: ['machine learning'] });
    expect(keep(post('Machine   learning, explained'))).toBe(false);
  });

  it('with include words, keeps only posts that mention one', () => {
    const keep = keywordFilter({ ...none, include: ['Rust', 'WebAssembly'] });
    expect(keep(post('Rust 2.0 is out'))).toBe(true);
    expect(keep(post('Shipping WebAssembly at scale'))).toBe(true);
    expect(keep(post('A Go tutorial'))).toBe(false);
  });

  it('lets a leave-out word win over an include word', () => {
    const keep = keywordFilter({
      muted: ['sponsored'],
      include: ['Rust'],
      exclude: [],
    });
    expect(keep(post('Rust tips (sponsored)'))).toBe(false);
  });

  it('treats special characters literally', () => {
    const keep = keywordFilter({ ...none, exclude: ['C++'] });
    expect(keep(post('Modern C++ in 2026'))).toBe(false);
    expect(keep(post('C is fine'))).toBe(true);
  });
});
