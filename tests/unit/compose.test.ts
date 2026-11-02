import { describe, expect, it } from 'vitest';
import { UnknownVariantError, compositionFromVariants, getComposition, regenerateContent, setComposition } from '@/lib/compose';
import { createSupabaseMock, pgError, type QueryCall } from '../helpers/supabase-mock';
import { variant } from '../helpers/fixtures';

const RESUME = 'r-1';

function store(variants: ReturnType<typeof variant>[], joins: { variant_id: string; position: number }[]) {
  return createSupabaseMock((q: QueryCall) => {
    if (q.table === 'resume_sections' && q.op === 'select') return { data: joins };
    if (q.table === 'section_variants' && q.op === 'select') return { data: variants };
    return undefined;
  });
}

describe('compositionFromVariants', () => {
  it('maps variants to renderer input with canonical titles, preserving order', () => {
    const vs = [variant('skills'), variant('header')];
    expect(compositionFromVariants(vs)).toEqual([
      { kind: 'skills', title: 'Technical Skills', data: vs[0].data },
      { kind: 'header', title: 'Header', data: vs[1].data },
    ]);
  });

  it('returns [] for no variants', () => {
    expect(compositionFromVariants([])).toEqual([]);
  });
});

describe('getComposition', () => {
  it('returns variants in join-position order even when the DB returns them unordered', async () => {
    const a = variant('header');
    const b = variant('experience');
    const c = variant('skills');
    const { client, callsTo } = store([c, a, b], [
      { variant_id: a.id, position: 0 },
      { variant_id: b.id, position: 1 },
      { variant_id: c.id, position: 2 },
    ]);
    const out = await getComposition(client, RESUME);
    expect(out.map((v) => v.id)).toEqual([a.id, b.id, c.id]);
    expect(callsTo('resume_sections')[0].filters).toContainEqual(['eq', 'resume_id', RESUME]);
    expect(callsTo('resume_sections')[0].filters).toContainEqual(['order', 'position', { ascending: true }]);
    expect(callsTo('section_variants')[0].filters).toContainEqual(['in', 'id', [a.id, b.id, c.id]]);
  });

  it('drops join rows whose variant is no longer visible (deleted or RLS-hidden)', async () => {
    const a = variant('header');
    const { client } = store([a], [
      { variant_id: a.id, position: 0 },
      { variant_id: 'gone', position: 1 },
    ]);
    expect((await getComposition(client, RESUME)).map((v) => v.id)).toEqual([a.id]);
  });

  it('short-circuits with no variant query for an empty composition', async () => {
    const { client, callsTo } = store([], []);
    expect(await getComposition(client, RESUME)).toEqual([]);
    expect(callsTo('section_variants')).toHaveLength(0);
  });

  it('throws upstream errors from either query', async () => {
    const joinsDown = createSupabaseMock((q) => (q.table === 'resume_sections' ? { error: pgError() } : undefined));
    await expect(getComposition(joinsDown.client, RESUME)).rejects.toMatchObject({ message: 'upstream failure' });

    const variantsDown = createSupabaseMock((q) => {
      if (q.table === 'resume_sections') return { data: [{ variant_id: 'x', position: 0 }] };
      if (q.table === 'section_variants') return { error: pgError('variants down') };
    });
    await expect(getComposition(variantsDown.client, RESUME)).rejects.toMatchObject({ message: 'variants down' });
  });
});

describe('setComposition', () => {
  it('replaces join rows with positions 0..n-1 and refreshes the text cache', async () => {
    const a = variant('header');
    const b = variant('skills');
    const { client, calls } = store([a, b], [
      { variant_id: a.id, position: 0 },
      { variant_id: b.id, position: 1 },
    ]);
    const out = await setComposition(client, RESUME, [a.id, b.id]);
    expect(out.map((v) => v.id)).toEqual([a.id, b.id]);

    const ops = calls.map((c) => `${c.table}:${c.op}`);
    expect(ops).toEqual([
      'section_variants:select',
      'resume_sections:delete',
      'resume_sections:insert',
      'resume_sections:select',
      'section_variants:select',
      'resumes:update',
    ]);
    expect(calls[2].payload).toEqual([
      { resume_id: RESUME, variant_id: a.id, position: 0 },
      { resume_id: RESUME, variant_id: b.id, position: 1 },
    ]);
    const update = calls[5];
    expect(update.filters).toContainEqual(['eq', 'id', RESUME]);
    expect((update.payload as any).content).toContain('Ada Lovelace');
  });

  it('skips the insert for an empty composition but still clears and re-caches', async () => {
    const { client, calls } = store([], []);
    await setComposition(client, RESUME, []);
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      'resume_sections:delete',
      'resume_sections:select',
      'resumes:update',
    ]);
    expect((calls[2].payload as any).content).toBe('');
  });

  it('propagates a delete failure without inserting', async () => {
    const { client, callsTo } = createSupabaseMock((q) =>
      q.table === 'resume_sections' && q.op === 'delete' ? { error: pgError() } : undefined
    );
    await expect(setComposition(client, RESUME, ['v'])).rejects.toBeTruthy();
    expect(callsTo('resume_sections', 'insert')).toHaveLength(0);
  });

  it('rejects unknown or invisible variant ids before deleting anything', async () => {
    const mine = variant('header');
    const { client, callsTo } = store([mine], []);
    await expect(setComposition(client, RESUME, [mine.id, 'someone-elses'])).rejects.toBeInstanceOf(UnknownVariantError);
    expect(callsTo('resume_sections', 'delete')).toHaveLength(0);
    expect(callsTo('resume_sections', 'insert')).toHaveLength(0);
  });

  it('counts a repeated variant id once when verifying visibility', async () => {
    const v = variant('skills');
    const { client, callsTo } = store([v], [{ variant_id: v.id, position: 0 }, { variant_id: v.id, position: 1 }]);
    await setComposition(client, RESUME, [v.id, v.id]);
    expect(callsTo('section_variants', 'select')[0].filters).toContainEqual(['in', 'id', [v.id]]);
    expect((callsTo('resume_sections', 'insert')[0].payload as unknown[]).length).toBe(2);
  });

  it('propagates a failure of the visibility check', async () => {
    const { client, callsTo } = createSupabaseMock((q) => (q.table === 'section_variants' ? { error: pgError('variants down') } : undefined));
    await expect(setComposition(client, RESUME, ['v'])).rejects.toMatchObject({ message: 'variants down' });
    expect(callsTo('resume_sections', 'delete')).toHaveLength(0);
  });

  // Residual risk: a variant deleted between the check and the insert still
  // leaves the resume empty; making this atomic needs a Postgres function.
  it('still surfaces an insert failure that races the visibility check', async () => {
    const v = variant('header');
    const { client } = createSupabaseMock((q) => {
      if (q.table === 'section_variants') return { data: [v] };
      if (q.table === 'resume_sections' && q.op === 'insert') return { error: pgError('insert or update on table violates foreign key constraint') };
    });
    await expect(setComposition(client, RESUME, [v.id])).rejects.toMatchObject({ message: expect.stringContaining('foreign key') });
  });
});

describe('regenerateContent', () => {
  it('writes rendered text to resumes.content and throws on failure', async () => {
    const ok = createSupabaseMock();
    await regenerateContent(ok.client, RESUME, [variant('header')]);
    expect(ok.callsTo('resumes', 'update')[0].payload).toEqual({ content: expect.stringContaining('Ada Lovelace') });

    const down = createSupabaseMock(() => ({ error: pgError() }));
    await expect(regenerateContent(down.client, RESUME, [])).rejects.toBeTruthy();
  });
});
