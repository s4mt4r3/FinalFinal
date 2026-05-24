// ============================================================
// lib/keyword-matcher.ts
// ============================================================
// Extract candidate keywords from a job posting and compare
// them against a resume. The goal: surface which technical
// terms the JD emphasizes that the resume doesn't mention.
// ============================================================

// ------------------------------------------------------------
// Curated dictionary of common terms found in tech / quant /
// data / product job postings. We give phrases priority by
// listing the longer phrase first so the matcher prefers
// "machine learning" over the unigram "learning".
// ------------------------------------------------------------
const DICTIONARY: string[] = [
  // languages
  'python', 'java', 'javascript', 'typescript', 'c++', 'c#', 'go', 'golang',
  'rust', 'ruby', 'kotlin', 'swift', 'scala', 'r', 'matlab', 'sql', 'bash',
  'shell', 'php', 'objective-c',
  // web/frameworks
  'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte', 'node.js', 'nodejs',
  'express', 'django', 'flask', 'fastapi', 'rails', 'spring', 'spring boot',
  '.net', 'asp.net', 'laravel', 'graphql', 'rest', 'restful', 'grpc',
  'websocket', 'webpack', 'vite', 'redux', 'tailwind',
  // ml / data
  'machine learning', 'deep learning', 'neural network', 'pytorch', 'tensorflow',
  'keras', 'scikit-learn', 'sklearn', 'pandas', 'numpy', 'scipy', 'jupyter',
  'jax', 'huggingface', 'transformers', 'nlp', 'computer vision', 'cv',
  'reinforcement learning', 'rl', 'llm', 'rag', 'embedding', 'embeddings',
  'vector database', 'mlops', 'data science', 'feature engineering',
  // data eng
  'spark', 'pyspark', 'hadoop', 'airflow', 'dbt', 'snowflake', 'databricks',
  'bigquery', 'redshift', 'kafka', 'pulsar', 'rabbitmq', 'etl', 'elt',
  // cloud / infra
  'aws', 'gcp', 'azure', 'lambda', 'ec2', 's3', 'rds', 'dynamodb', 'cloudfront',
  'kubernetes', 'k8s', 'docker', 'terraform', 'pulumi', 'ansible', 'helm',
  'argocd', 'istio', 'nginx', 'linux', 'unix',
  // db
  'postgres', 'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis', 'cassandra',
  'elasticsearch', 'clickhouse', 'kdb', 'kdb+/q', 'q',
  // ci/cd / tools
  'git', 'github', 'gitlab', 'jenkins', 'circleci', 'github actions', 'ci/cd',
  'cicd', 'bazel', 'gradle', 'maven', 'npm', 'yarn', 'pnpm',
  // quant / finance
  'derivatives', 'options', 'fixed income', 'equities', 'futures', 'fx',
  'risk', 'portfolio', 'alpha', 'beta', 'sharpe', 'monte carlo',
  'time series', 'volatility', 'pricing', 'hedging', 'bloomberg', 'reuters',
  // testing / methods
  'tdd', 'unit testing', 'integration testing', 'pytest', 'jest', 'mocha',
  'playwright', 'cypress', 'selenium',
  // soft / methodologies
  'agile', 'scrum', 'kanban', 'jira', 'leadership', 'mentorship', 'mentoring',
  'collaboration', 'cross-functional', 'stakeholder', 'roadmap',
  // misc tech
  'api', 'microservices', 'distributed systems', 'concurrency', 'multithreading',
  'parallel', 'gpu', 'cuda', 'oop', 'functional programming', 'tcp',
  'http', 'websockets', 'oauth', 'jwt', 'rbac',
];

const STOPWORDS = new Set([
  'the', 'and', 'or', 'but', 'with', 'for', 'from', 'into', 'about', 'over',
  'under', 'this', 'that', 'these', 'those', 'their', 'they', 'them', 'will',
  'would', 'could', 'should', 'have', 'has', 'had', 'are', 'was', 'were',
  'been', 'being', 'is', 'be', 'we', 'you', 'your', 'our', 'in', 'on', 'at',
  'by', 'as', 'an', 'a', 'of', 'to', 'it', 'its', 'not', 'no', 'so', 'if',
  'than', 'then', 'such', 'any', 'each', 'all', 'more', 'most', 'some',
  'who', 'what', 'when', 'where', 'how', 'job', 'role', 'position', 'team',
  'work', 'working', 'including', 'etc', 'years', 'year', 'experience',
  'experienced', 'strong', 'good', 'great', 'excellent', 'ability', 'able',
  'must', 'required', 'preferred', 'plus', 'nice', 'help', 'helps', 'helping',
  'build', 'building', 'built', 'develop', 'developing', 'developed',
  'design', 'designing', 'designed', 'create', 'creating', 'created',
  'write', 'writing', 'wrote', 'use', 'using', 'used', 'understand',
  'understanding', 'understood', 'support', 'supporting', 'supported',
  'across', 'within', 'while', 'also', 'well', 'including', 'environment',
  'environments', 'project', 'projects', 'product', 'products', 'company',
  'companies', 'business', 'businesses', 'people', 'person', 'colleague',
  'colleagues', 'engineer', 'engineers', 'engineering', 'software',
  'familiarity', 'knowledge', 'familiar', 'skills', 'skill', 'tools',
  'technologies', 'technology', 'tech', 'stack', 'systems', 'system',
  'intern', 'internship', 'candidate', 'candidates', 'applicants', 'we', 'us',
  'our', 'your', 'their', 'his', 'her', 'minimum', 'preferred', 'plus',
  'looking', 'seeking', 'join', 'joining', 'develop', 'developing',
]);

function normalize(text: string): string {
  return text.toLowerCase();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function termRegex(term: string): RegExp {
  // Word-ish boundary that respects + . # / -  characters appearing inside
  // tech terms like "c++", "ci/cd", "node.js", ".net", "c#".
  const escaped = escapeRe(term);
  return new RegExp(`(^|[^a-z0-9+/.#-])${escaped}(?=[^a-z0-9+/.#-]|$)`, 'i');
}

interface Candidate {
  term: string;
  count: number;
}

// ------------------------------------------------------------
// Pull candidate keywords from the JD:
//   1. Every dictionary term that appears
//   2. Plus all-caps acronyms (e.g., REST, SOC, ETL)
//   3. Plus capitalized multi-letter tokens (proper nouns / tools)
// ------------------------------------------------------------
function extractCandidates(jobText: string): Candidate[] {
  const lower = normalize(jobText);
  const counts = new Map<string, number>();

  // 1. Dictionary terms
  for (const term of DICTIONARY) {
    const re = new RegExp(termRegex(term).source, 'gi');
    const matches = lower.match(re);
    if (matches && matches.length) counts.set(term, matches.length);
  }

  // 2. Acronyms (in original case, then lowercase the key)
  const acronymRe = /\b[A-Z][A-Z0-9]{1,5}(?:\/[A-Z0-9]{1,5})?\b/g;
  const acronyms = jobText.match(acronymRe) || [];
  for (const a of acronyms) {
    const k = a.toLowerCase();
    if (STOPWORDS.has(k)) continue;
    if (k.length < 2) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  // 3. Multi-word frequency: capitalized proper nouns in JD. We use a
  //    sentence-aware split to avoid treating sentence-initial words
  //    ("Familiarity", "Knowledge") as proper-noun signal.
  const sentences = jobText.split(/(?<=[.!?])\s+/);
  const capRe = /\b[A-Z][a-zA-Z]{2,}(?:\s+[A-Z][a-zA-Z]{2,}){0,2}\b/g;
  for (const sentence of sentences) {
    // Drop the first token of the sentence so a sentence-initial capital
    // doesn't pollute the candidate set.
    const body = sentence.replace(/^\S+\s*/, '');
    const caps = body.match(capRe) || [];
    for (const c of caps) {
      const k = c.toLowerCase();
      const tokens = k.split(/\s+/);
      if (tokens.some((t) => STOPWORDS.has(t))) continue;
      if (counts.has(k)) {
        counts.set(k, (counts.get(k) ?? 0) + 1);
        continue;
      }
      if (!k.includes(' ') && k.length < 4) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count);
}

export interface MatchResult {
  matched: string[];
  missing: string[];
  score: number;
  all_keywords: { term: string; count: number; matched: boolean }[];
}

export function matchKeywords(resumeText: string, jobText: string, limit = 30): MatchResult {
  const candidates = extractCandidates(jobText).slice(0, limit);
  const resumeLower = normalize(resumeText);

  const matched: string[] = [];
  const missing: string[] = [];
  const all_keywords = candidates.map((c) => {
    const present = termRegex(c.term).test(resumeLower);
    if (present) matched.push(c.term);
    else missing.push(c.term);
    return { term: c.term, count: c.count, matched: present };
  });

  const score =
    candidates.length === 0
      ? 0
      : Math.round((matched.length / candidates.length) * 100);

  return { matched, missing, score, all_keywords };
}
