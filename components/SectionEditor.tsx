'use client';

// ============================================================
// components/SectionEditor.tsx
// ============================================================
// The guided, per-kind editor. Given a section kind and its
// structured data, it renders the right "slots" with helpful
// placeholders so the user always knows what to put where:
//
//   header      → contact fields
//   education /
//   experience /
//   projects   /
//   leadership  → repeatable item cards (two-column, like Jake)
//   skills      → category / items rows
//   coursework  → a simple course list
//
// Fully controlled: it never holds state, it calls onChange with
// the next data object. Styling uses the global ff-* classes.
// ============================================================

import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import {
  type SectionKind,
  ITEM_FIELDS,
  HEADER_FIELDS,
  ITEM_NOUN,
  isItemList,
  emptyItemFor,
  type FieldSpec,
} from '@/lib/sections';

// ---- immutable array helpers ----
function replaceAt<T>(arr: T[], i: number, v: T): T[] {
  const next = arr.slice();
  next[i] = v;
  return next;
}
function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, idx) => idx !== i);
}
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

// ---- small inputs ----
function TextField({ label, value, placeholder, hint, onChange }: {
  label: string; value: string; placeholder?: string; hint?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <label className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.3 }}>{label}</label>
      <input
        className="ff-input"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="ff-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
    </div>
  );
}

function IconBtn({ title, onClick, disabled, danger, children }: any) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 26, height: 26, borderRadius: 3, border: '1px solid var(--line-2)',
        background: 'var(--paper)', cursor: disabled ? 'not-allowed' : 'pointer',
        color: danger ? 'var(--red)' : 'var(--ink-3)', opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ---- bullets sub-editor ----
function BulletsEditor({ label, placeholder, bullets, onChange }: {
  label: string; placeholder?: string; bullets: string[];
  onChange: (b: string[]) => void;
}) {
  const list = bullets && bullets.length ? bullets : [''];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.3 }}>{label}</label>
      {list.map((b, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span className="ff-mono" style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: 12 }}>•</span>
          <textarea
            className="ff-textarea"
            style={{ minHeight: 38, resize: 'vertical' }}
            value={b}
            placeholder={placeholder}
            onChange={(e) => onChange(replaceAt(list, i, e.target.value))}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <IconBtn title="Move up" disabled={i === 0} onClick={() => onChange(move(list, i, -1))}><ChevronUp size={13} /></IconBtn>
            <IconBtn title="Remove bullet" danger disabled={list.length === 1 && !b} onClick={() => onChange(removeAt(list, i).length ? removeAt(list, i) : [''])}><Trash2 size={13} /></IconBtn>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="ff-btn ff-btn-ghost ff-btn-sm"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => onChange([...list, ''])}
      >
        <Plus size={12} /> Add bullet
      </button>
    </div>
  );
}

// ---- item card (education / experience / projects / leadership) ----
function ItemCard({ kind, fields, item, index, count, onChange, onRemove, onMove }: {
  kind: SectionKind; fields: FieldSpec[]; item: any; index: number; count: number;
  onChange: (it: any) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const textFields = fields.filter((f) => f.type !== 'bullets');
  const bulletField = fields.find((f) => f.type === 'bullets');

  return (
    <div style={{
      border: '1px solid var(--line-2)', borderRadius: 4, padding: 14,
      background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="ff-mono ff-label" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          {ITEM_NOUN[kind]} {index + 1}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn title="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp size={13} /></IconBtn>
          <IconBtn title="Move down" disabled={index === count - 1} onClick={() => onMove(1)}><ChevronDown size={13} /></IconBtn>
          <IconBtn title="Remove" danger onClick={onRemove}><Trash2 size={13} /></IconBtn>
        </div>
      </div>

      {/* two-column grid mirrors Jake's left/right layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {textFields.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={item[f.key] ?? ''}
            placeholder={f.placeholder}
            hint={f.hint}
            onChange={(v) => onChange({ ...item, [f.key]: v })}
          />
        ))}
      </div>

      {bulletField && (
        <BulletsEditor
          label={bulletField.label}
          placeholder={bulletField.placeholder}
          bullets={item.bullets ?? []}
          onChange={(b) => onChange({ ...item, bullets: b })}
        />
      )}
    </div>
  );
}

// ============================================================
// Main editor
// ============================================================
export default function SectionEditor({ kind, data, onChange }: {
  kind: SectionKind;
  data: any;
  onChange: (data: any) => void;
}) {
  // ---- header ----
  if (kind === 'header') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {HEADER_FIELDS.map((f) => (
          <div key={f.key} style={{ gridColumn: f.key === 'name' || f.key === 'location' ? '1 / -1' : 'auto' }}>
            <TextField
              label={f.label}
              value={data?.[f.key] ?? ''}
              placeholder={f.placeholder}
              onChange={(v) => onChange({ ...data, [f.key]: v })}
            />
          </div>
        ))}
      </div>
    );
  }

  // ---- coursework ----
  if (kind === 'coursework') {
    const courses: string[] = data?.courses?.length ? data.courses : [''];
    const set = (c: string[]) => onChange({ courses: c.length ? c : [''] });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
          One course per row — they’ll flow into Jake’s 4-column list.
        </span>
        {courses.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input
              className="ff-input"
              value={c}
              placeholder="Data Structures"
              onChange={(e) => set(replaceAt(courses, i, e.target.value))}
            />
            <IconBtn title="Remove" danger disabled={courses.length === 1 && !c} onClick={() => set(removeAt(courses, i))}><Trash2 size={13} /></IconBtn>
          </div>
        ))}
        <button type="button" className="ff-btn ff-btn-ghost ff-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set([...courses, ''])}>
          <Plus size={12} /> Add course
        </button>
      </div>
    );
  }

  // ---- skills ----
  if (kind === 'skills') {
    const cats: any[] = data?.categories?.length ? data.categories : [emptyItemFor('skills')];
    const set = (c: any[]) => onChange({ categories: c.length ? c : [emptyItemFor('skills')] });
    const fields = ITEM_FIELDS.skills!;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cats.map((cat, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr auto', gap: 8, alignItems: 'flex-end' }}>
            <TextField label={fields[0].label} value={cat.category} placeholder={fields[0].placeholder} onChange={(v) => set(replaceAt(cats, i, { ...cat, category: v }))} />
            <TextField label={fields[1].label} value={cat.items} placeholder={fields[1].placeholder} onChange={(v) => set(replaceAt(cats, i, { ...cat, items: v }))} />
            <div style={{ display: 'flex', gap: 3, paddingBottom: 1 }}>
              <IconBtn title="Move up" disabled={i === 0} onClick={() => set(move(cats, i, -1))}><ChevronUp size={13} /></IconBtn>
              <IconBtn title="Remove" danger disabled={cats.length === 1} onClick={() => set(removeAt(cats, i))}><Trash2 size={13} /></IconBtn>
            </div>
          </div>
        ))}
        <button type="button" className="ff-btn ff-btn-ghost ff-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set([...cats, emptyItemFor('skills')])}>
          <Plus size={12} /> Add category
        </button>
      </div>
    );
  }

  // ---- item-list kinds: education / experience / projects / leadership ----
  if (isItemList(kind)) {
    const fields = ITEM_FIELDS[kind]!;
    const items: any[] = data?.items?.length ? data.items : [emptyItemFor(kind)];
    const set = (it: any[]) => onChange({ items: it.length ? it : [emptyItemFor(kind)] });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item, i) => (
          <ItemCard
            key={i}
            kind={kind}
            fields={fields}
            item={item}
            index={i}
            count={items.length}
            onChange={(it) => set(replaceAt(items, i, it))}
            onRemove={() => set(removeAt(items, i))}
            onMove={(dir) => set(move(items, i, dir))}
          />
        ))}
        <button type="button" className="ff-btn ff-btn-ghost ff-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set([...items, emptyItemFor(kind)])}>
          <Plus size={12} /> Add {ITEM_NOUN[kind]}
        </button>
      </div>
    );
  }

  return null;
}
