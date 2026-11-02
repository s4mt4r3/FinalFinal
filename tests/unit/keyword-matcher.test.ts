import { describe, expect, it } from 'vitest';
import { matchKeywords } from '@/lib/keyword-matcher';

const JD = `We are hiring a backend engineer. You will use Python and PostgreSQL daily.
Experience with Kubernetes, Docker and AWS is required. Familiarity with CI/CD and C++ is a plus.
Knowledge of Node.js, .NET or machine learning helps. We value Python expertise.`;

describe('matchKeywords', () => {
  it('extracts dictionary terms and splits them into matched and missing', () => {
    const r = matchKeywords('Built services in Python on AWS with Docker and C++.', JD);
    expect(r.matched).toEqual(expect.arrayContaining(['python', 'aws', 'docker', 'c++']));
    expect(r.missing).toEqual(expect.arrayContaining(['kubernetes', 'postgresql', 'ci/cd', 'node.js', '.net', 'machine learning']));
    expect(r.matched.filter((t) => r.missing.includes(t))).toEqual([]);
    expect(r.all_keywords.length).toBe(r.matched.length + r.missing.length);
  });

  it('computes score as the rounded matched percentage', () => {
    const r = matchKeywords('python', JD);
    expect(r.score).toBe(Math.round((r.matched.length / r.all_keywords.length) * 100));
  });

  it('ranks terms by frequency', () => {
    const r = matchKeywords('', JD);
    expect(r.all_keywords[0].term).toBe('python');
    expect(r.all_keywords[0].count).toBeGreaterThanOrEqual(2);
  });

  it('respects tech-term boundaries (java ≠ javascript, c ≠ c++, go ≠ google)', () => {
    const r = matchKeywords('I know JavaScript and C++ and Google Sheets.', 'Requirements: Java, Go, and JavaScript.');
    const status = Object.fromEntries(r.all_keywords.map((k) => [k.term, k.matched]));
    expect(status.javascript).toBe(true);
    expect(status.java).toBe(false);
    expect(status.go).toBe(false);
  });

  // BUG: "." is allowed inside terms (node.js, .net), so the boundary lookahead
  // rejected a term followed by a sentence-ending period — and resume bullets
  // almost always end in one.
  it('matches terms at the end of a sentence', () => {
    const r = matchKeywords('Deployed services on Kubernetes. Wrote tooling in C++.', 'Kubernetes and C++ required');
    expect(r.missing).toEqual([]);
    expect(r.matched).toEqual(expect.arrayContaining(['kubernetes', 'c++']));
  });

  it('still keeps dotted terms distinct (node.js does not match "node.json")', () => {
    const r = matchKeywords('Edited node.json config, used go.dev docs', 'Node.js and Go required');
    expect(r.missing).toEqual(expect.arrayContaining(['node.js', 'go']));
  });

  it('is case-insensitive', () => {
    expect(matchKeywords('KUBERNETES', 'Deep kubernetes expertise').matched).toContain('kubernetes');
  });

  it('caps the candidate list at the limit', () => {
    const many = 'python java rust go scala kotlin swift ruby php sql bash react vue angular django flask spark kafka aws gcp azure docker kubernetes terraform redis mongodb mysql postgres git jenkins numpy pandas';
    expect(matchKeywords('', many, 10).all_keywords).toHaveLength(10);
  });

  it('returns a zero score and empty lists for a JD with no keywords', () => {
    expect(matchKeywords('anything', 'the and or but with for')).toEqual({ matched: [], missing: [], score: 0, all_keywords: [] });
  });

  it('treats regex metacharacters in input as plain text', () => {
    expect(() => matchKeywords('(((( [[[ ***', 'C++ and C# and .NET (Core) [required] ***')).not.toThrow();
  });

  it('handles unicode and very long input quickly', () => {
    const big = ('Python Kubernetes données 数据 ' + 'lorem ipsum '.repeat(50)).repeat(40);
    const t0 = performance.now();
    const r = matchKeywords(big.slice(0, 100_000), big.slice(0, 20_000));
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r.matched).toContain('python');
  });
});
