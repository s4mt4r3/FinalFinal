import { describe, expect, it } from 'vitest';
import {
  HEADER_FIELDS,
  ITEM_FIELDS,
  ITEM_NOUN,
  SECTION_BLURB,
  SECTION_ORDER,
  SECTION_TITLE,
  emptyDataFor,
  emptyItemFor,
  isItemList,
  summarizeVariant,
  type SectionKind,
} from '@/lib/sections';
import { SectionKindSchema } from '@/lib/api-helpers';
import { ALL_KINDS, sampleData } from '../helpers/fixtures';

describe('section model', () => {
  it('keeps the TS kinds, Zod enum and display order in sync', () => {
    expect([...SECTION_ORDER].sort()).toEqual([...SectionKindSchema.options].sort());
    expect(SECTION_ORDER[0]).toBe('header');
    for (const k of SECTION_ORDER) {
      expect(SECTION_TITLE[k]).toBeTruthy();
      expect(SECTION_BLURB[k]).toBeTruthy();
      expect(ITEM_NOUN[k]).toBeTruthy();
    }
  });

  it.each(ALL_KINDS)('emptyDataFor(%s) yields one editable slot', (kind) => {
    const data: any = emptyDataFor(kind);
    if (kind === 'header') expect(Object.keys(data)).toEqual(HEADER_FIELDS.map((f) => f.key));
    else if (kind === 'coursework') expect(data.courses).toEqual(['']);
    else if (kind === 'skills') expect(data.categories).toHaveLength(1);
    else expect(data.items).toHaveLength(1);
  });

  it('returns fresh objects so editing one template never mutates another', () => {
    const a: any = emptyDataFor('experience');
    a.items[0].bullets.push('x');
    expect((emptyDataFor('experience') as any).items[0].bullets).toEqual(['']);
  });

  it('declares editor fields that exist on each empty item', () => {
    for (const [kind, fields] of Object.entries(ITEM_FIELDS) as [SectionKind, any[]][]) {
      const item = emptyItemFor(kind);
      for (const f of fields) expect(item).toHaveProperty(f.key);
    }
    expect(emptyItemFor('header')).toEqual({});
  });

  it('identifies item-list kinds', () => {
    expect(ALL_KINDS.filter(isItemList)).toEqual(['education', 'experience', 'projects', 'leadership']);
  });
});

describe('summarizeVariant', () => {
  it.each([
    ['header', 'Ada Lovelace'],
    ['coursework', '5 courses'],
    ['skills', 'Languages'],
    ['education', 'University of London'],
    ['experience', 'Analytical Engines Ltd'],
    ['projects', 'Note G'],
    ['leadership', 'Royal Society'],
  ] as [SectionKind, string][])('summarises %s', (kind, expected) => {
    expect(summarizeVariant(kind, sampleData[kind])).toBe(expected);
  });

  it.each([
    ['header', {}, 'Unnamed'],
    ['coursework', {}, '0 courses'],
    ['skills', {}, 'No categories'],
    ['education', {}, 'No schools'],
    ['experience', { items: [{ company: '' }] }, 'No roles'],
    ['projects', {}, 'No projects'],
    ['leadership', {}, 'No entries'],
  ] as [SectionKind, any, string][])('has a readable fallback for empty %s', (kind, data, expected) => {
    expect(summarizeVariant(kind, data)).toBe(expected);
  });

  it('handles null data', () => {
    expect(summarizeVariant('header', null)).toBe('Empty');
  });
});
