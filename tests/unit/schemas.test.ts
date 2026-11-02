import { describe, expect, it } from 'vitest';
import {
  ApplicationCreateSchema,
  ApplicationStatusSchema,
  ApplicationUpdateSchema,
  ResumeCreateSchema,
  ResumeUpdateSchema,
  SectionCreateSchema,
  SectionKindSchema,
  SectionUpdateSchema,
} from '@/lib/api-helpers';

const UUID = '3f1c2a5e-8b9d-4e7f-a1b2-c3d4e5f60718';
const s = (n: number, ch = 'x') => ch.repeat(n);
const SCRIPT = '<script>alert(document.cookie)</script>';
const SQL = "'; DROP TABLE resumes; --";

const fieldErrors = (r: { success: boolean; error?: any }) =>
  r.success ? {} : r.error.flatten().fieldErrors;

describe('ResumeCreateSchema', () => {
  it('accepts a minimal body and fills defaults', () => {
    expect(ResumeCreateSchema.parse({ name: 'SWE' })).toEqual({
      name: 'SWE',
      content: '',
      tags: [],
      notes: '',
    });
  });

  it('accepts a full body', () => {
    const body = {
      name: 'Quant',
      content: 'text',
      parent_id: UUID,
      tags: ['a', 'b'],
      notes: 'n',
      source_file_path: 'u/1.pdf',
      sections: [UUID],
    };
    expect(ResumeCreateSchema.parse(body)).toEqual(body);
  });

  it('trims the name and rejects whitespace-only names', () => {
    expect(ResumeCreateSchema.parse({ name: '  SWE  ' }).name).toBe('SWE');
    expect(fieldErrors(ResumeCreateSchema.safeParse({ name: '   ' }))).toHaveProperty('name');
  });

  it.each([
    ['name', { name: s(201) }],
    ['name', { name: 42 }],
    ['name', {}],
    ['content', { name: 'a', content: s(100_001) }],
    ['parent_id', { name: 'a', parent_id: 'not-a-uuid' }],
    ['tags', { name: 'a', tags: Array(21).fill('t') }],
    ['tags', { name: 'a', tags: [s(41)] }],
    ['tags', { name: 'a', tags: 'single-string' }],
    ['notes', { name: 'a', notes: s(2001) }],
    ['source_file_path', { name: 'a', source_file_path: s(501) }],
    ['sections', { name: 'a', sections: Array(41).fill(UUID) }],
    ['sections', { name: 'a', sections: ['nope'] }],
  ])('rejects invalid %s', (field, body) => {
    const r = ResumeCreateSchema.safeParse(body);
    expect(r.success).toBe(false);
    expect(fieldErrors(r)).toHaveProperty(field);
  });

  it('accepts every field exactly at its upper bound', () => {
    const r = ResumeCreateSchema.safeParse({
      name: s(200),
      content: s(100_000),
      tags: Array(20).fill(s(40)),
      notes: s(2000),
      source_file_path: s(500),
      sections: Array(40).fill(UUID),
    });
    expect(r.success).toBe(true);
  });

  it('strips unknown keys so clients cannot mass-assign user_id or ids', () => {
    const parsed = ResumeCreateSchema.parse({
      name: 'a',
      user_id: UUID,
      id: UUID,
      created_at: '2020-01-01',
      __proto__: { polluted: true },
    } as any);
    expect(parsed).not.toHaveProperty('user_id');
    expect(parsed).not.toHaveProperty('id');
    expect(parsed).not.toHaveProperty('created_at');
    expect(({} as any).polluted).toBeUndefined();
  });

  it('stores script tags and SQL fragments verbatim (escaping happens at render, SQL is parameterised)', () => {
    const r = ResumeCreateSchema.parse({ name: SCRIPT, notes: SQL, tags: [SQL] });
    expect(r.name).toBe(SCRIPT);
    expect(r.notes).toBe(SQL);
  });
});

describe('ResumeUpdateSchema', () => {
  // A PATCH that only renames must not smuggle in defaults (tags: [], notes: '')
  // that would wipe the stored values.
  it('does not apply create-time defaults to omitted fields', () => {
    expect(ResumeUpdateSchema.parse({ name: 'renamed' })).toEqual({ name: 'renamed' });
    expect(ResumeUpdateSchema.parse({})).toEqual({});
  });

  it('still validates provided fields', () => {
    expect(ResumeUpdateSchema.safeParse({ name: '' }).success).toBe(false);
    expect(ResumeUpdateSchema.safeParse({ sections: ['x'] }).success).toBe(false);
    expect(ResumeUpdateSchema.safeParse({ sections: [] }).success).toBe(true);
  });
});

describe('SectionKindSchema', () => {
  it.each(['header', 'education', 'coursework', 'experience', 'projects', 'skills', 'leadership'])(
    'accepts %s',
    (k) => expect(SectionKindSchema.parse(k)).toBe(k)
  );

  it.each(['', 'Header', 'summary', SQL, null])('rejects %s', (k) => {
    expect(SectionKindSchema.safeParse(k).success).toBe(false);
  });
});

describe('SectionCreateSchema', () => {
  it('accepts a minimal body and defaults data to {}', () => {
    expect(SectionCreateSchema.parse({ kind: 'skills', label: 'Main' })).toEqual({
      kind: 'skills',
      label: 'Main',
      data: {},
    });
  });

  it.each([
    ['kind', { label: 'a' }],
    ['kind', { kind: 'nope', label: 'a' }],
    ['label', { kind: 'header', label: '' }],
    ['label', { kind: 'header', label: '   ' }],
    ['label', { kind: 'header', label: s(121) }],
    ['data', { kind: 'header', label: 'a', data: [] }],
    ['data', { kind: 'header', label: 'a', data: 'str' }],
    ['data', { kind: 'header', label: 'a', data: { [s(61)]: 1 } }],
  ])('rejects invalid %s', (field, body) => {
    const r = SectionCreateSchema.safeParse(body);
    expect(r.success).toBe(false);
    expect(fieldErrors(r)).toHaveProperty(field);
  });

  it('accepts label of 120 chars and a data key of 60 chars', () => {
    expect(SectionCreateSchema.safeParse({ kind: 'header', label: s(120), data: { [s(60)]: 1 } }).success).toBe(
      true
    );
  });

  // {"k":"<n chars>"} serialises to n + 8 characters; the cap is 50,000.
  it('enforces the 50 KB serialised-size cap at the exact boundary', () => {
    const ok = SectionCreateSchema.safeParse({ kind: 'skills', label: 'a', data: { k: s(49_992) } });
    const tooBig = SectionCreateSchema.safeParse({ kind: 'skills', label: 'a', data: { k: s(49_993) } });
    expect(ok.success).toBe(true);
    expect(tooBig.success).toBe(false);
    expect(JSON.stringify(tooBig.error!.flatten())).toContain('Section data too large');
  });

  it('rejects an oversized nested payload (1 MB of bullets)', () => {
    const data = { items: [{ bullets: Array(1000).fill(s(1000)) }] };
    expect(SectionCreateSchema.safeParse({ kind: 'experience', label: 'big', data }).success).toBe(false);
  });

  it('strips user_id from the body', () => {
    const parsed = SectionCreateSchema.parse({ kind: 'header', label: 'a', user_id: UUID } as any);
    expect(parsed).not.toHaveProperty('user_id');
  });
});

describe('SectionUpdateSchema', () => {
  it('accepts partial bodies and does not allow changing kind', () => {
    expect(SectionUpdateSchema.parse({ label: 'x' })).toEqual({ label: 'x' });
    expect(SectionUpdateSchema.parse({ data: { a: 1 } })).toEqual({ data: { a: 1 } });
    expect(SectionUpdateSchema.parse({ kind: 'skills' } as any)).toEqual({});
  });

  it('validates provided fields', () => {
    expect(SectionUpdateSchema.safeParse({ label: '' }).success).toBe(false);
    expect(SectionUpdateSchema.safeParse({ data: { k: s(50_000) } }).success).toBe(false);
  });
});

describe('ApplicationStatusSchema', () => {
  it.each(['applied', 'interviewing', 'offer', 'rejected', 'ghosted'])('accepts %s', (v) => {
    expect(ApplicationStatusSchema.parse(v)).toBe(v);
  });
  it.each(['hired', 'APPLIED', ''])('rejects %s', (v) => {
    expect(ApplicationStatusSchema.safeParse(v).success).toBe(false);
  });
});

describe('ApplicationCreateSchema', () => {
  it('accepts a minimal body and defaults status/notes', () => {
    expect(ApplicationCreateSchema.parse({ company: 'Acme' })).toEqual({
      company: 'Acme',
      status: 'applied',
      notes: '',
    });
  });

  it.each([
    ['company', {}],
    ['company', { company: '  ' }],
    ['company', { company: s(201) }],
    ['role', { company: 'a', role: s(201) }],
    ['resume_id', { company: 'a', resume_id: '123' }],
    ['status', { company: 'a', status: 'hired' }],
    ['notes', { company: 'a', notes: s(5001) }],
    ['date_applied', { company: 'a', date_applied: 'yesterday' }],
    ['date_applied', { company: 'a', date_applied: '2026-01-01' }],
  ])('rejects invalid %s', (field, body) => {
    const r = ApplicationCreateSchema.safeParse(body);
    expect(r.success).toBe(false);
    expect(fieldErrors(r)).toHaveProperty(field);
  });

  it('accepts boundary values, nullable role/resume_id and ISO datetimes', () => {
    expect(
      ApplicationCreateSchema.safeParse({
        company: s(200),
        role: null,
        resume_id: null,
        notes: s(5000),
        date_applied: '2026-10-14T12:00:00.000Z',
      }).success
    ).toBe(true);
  });

  it('keeps hostile text verbatim and strips unknown keys', () => {
    const r = ApplicationCreateSchema.parse({ company: SCRIPT, role: SQL, user_id: UUID } as any);
    expect(r.company).toBe(SCRIPT);
    expect(r).not.toHaveProperty('user_id');
  });
});

describe('ApplicationUpdateSchema', () => {
  // If partial() re-applied the default, every notes-only PATCH would silently
  // reset the application's status back to "applied".
  it('does not reset status when patching other fields', () => {
    expect(ApplicationUpdateSchema.parse({ notes: 'follow up' })).toEqual({ notes: 'follow up' });
  });

  it('validates provided fields', () => {
    expect(ApplicationUpdateSchema.safeParse({ status: 'nope' }).success).toBe(false);
    expect(ApplicationUpdateSchema.safeParse({ company: '' }).success).toBe(false);
  });
});
