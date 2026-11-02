import type { Composition } from '@/lib/resume-render';
import type { SectionKind } from '@/lib/sections';
import type { SectionVariant } from '@/types/database';
import { SECTION_TITLE } from '@/lib/sections';

export const sampleData: Record<SectionKind, any> = {
  header: {
    name: 'Ada Lovelace',
    location: 'London, UK',
    phone: '555-0100',
    email: 'ada@example.com',
    linkedin: 'linkedin.com/in/ada',
    github: 'github.com/ada',
    website: 'ada.dev',
  },
  education: {
    items: [{ school: 'University of London', degree: 'BSc Mathematics', dateRange: 'Sep. 1830 -- May 1834', location: 'London' }],
  },
  coursework: { courses: ['Analysis', 'Algebra', 'Logic', 'Mechanics', 'Probability'] },
  experience: {
    items: [
      {
        company: 'Analytical Engines Ltd',
        title: 'Programmer',
        dateRange: '1842 -- 1843',
        location: 'London',
        bullets: ['Wrote the first published algorithm', '', 'Translated Menabrea notes'],
      },
    ],
  },
  projects: {
    items: [{ name: 'Note G', tech: 'Bernoulli numbers', date: '1843', bullets: ['Computed B_8 on the engine'] }],
  },
  skills: {
    categories: [
      { category: 'Languages', items: 'English, French, Italian' },
      { category: '', items: '' },
    ],
  },
  leadership: {
    items: [{ organization: 'Royal Society', role: 'Correspondent', dateRange: '1840s', location: 'London', bullets: ['Debated Babbage'] }],
  },
};

export function composition(kinds: SectionKind[], overrides: Partial<Record<SectionKind, any>> = {}): Composition {
  return kinds.map((kind) => ({ kind, title: SECTION_TITLE[kind], data: overrides[kind] ?? sampleData[kind] }));
}

export const ALL_KINDS: SectionKind[] = ['header', 'education', 'coursework', 'experience', 'projects', 'skills', 'leadership'];

export function variant(kind: SectionKind, overrides: Partial<SectionVariant> = {}): SectionVariant {
  const id = overrides.id ?? `00000000-0000-4000-8000-${Math.floor(Math.random() * 1e12).toString().padStart(12, '0')}`;
  return {
    id,
    user_id: 'u1',
    kind,
    label: `${kind} v1`,
    data: sampleData[kind],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// TeX treats an unescaped % as "ignore the rest of this line", so a stray % in
// user data silently swallows closing braces. Count braces the way TeX would.
export function texBraceBalance(tex: string): number {
  let depth = 0;
  for (const line of tex.split('\n')) {
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '%') break;
      if (c === '{') depth++;
      if (c === '}') depth--;
      if (depth < 0) return depth;
    }
  }
  return depth;
}
