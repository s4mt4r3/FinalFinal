'use client';

// ============================================================
// components/SectionLibrary.tsx
// ============================================================
// The mix-and-match source of truth: every section variant the
// user has, grouped by kind. This is where "branching" lives —
// create as many variants of a section as you like (a quant-
// focused experience, a full-stack one, …) and the Builder picks
// between them per resume.
// ============================================================

import { useState } from 'react';
import { Plus, Pencil, Copy, Trash2, Layers } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  SECTION_ORDER,
  SECTION_TITLE,
  SECTION_BLURB,
  emptyDataFor,
  summarizeVariant,
  type SectionKind,
} from '@/lib/sections';
import type { SectionVariant } from '@/types/database';
import VariantEditorModal from './VariantEditorModal';

export default function SectionLibrary({
  variants,
  onReload,
  onFlash,
}: {
  variants: SectionVariant[];
  onReload: () => Promise<void> | void;
  onFlash: (msg: string, type?: 'success' | 'error') => void;
}) {
  const [editing, setEditing] = useState<
    | { mode: 'new'; kind: SectionKind; label: string; data: any }
    | { mode: 'edit'; variant: SectionVariant }
    | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const byKind = (kind: SectionKind) => variants.filter((v) => v.kind === kind);

  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
    onFlash(e instanceof Error ? e.message : 'Something went wrong', 'error');
  };

  const duplicate = async (v: SectionVariant) => {
    setBusyId(v.id);
    try {
      await api.sections.create({ kind: v.kind, label: `${v.label} (copy)`, data: v.data });
      await onReload();
      onFlash('Variant duplicated');
    } catch (e) { handleError(e); }
    finally { setBusyId(null); }
  };

  const remove = async (v: SectionVariant) => {
    if (!confirm(`Delete "${v.label}"? It will be removed from any resume that uses it.`)) return;
    setBusyId(v.id);
    try {
      await api.sections.delete(v.id);
      await onReload();
      onFlash('Variant deleted');
    } catch (e) { handleError(e); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <div style={{ marginBottom: 22 }}>
        <div className="ff-mono ff-label" style={{ color: 'var(--accent-2)', fontSize: 11 }}>Section library</div>
        <h1 className="ff-display" style={{ fontSize: 26, fontWeight: 500, margin: '6px 0 4px' }}>Your building blocks</h1>
        <div className="ff-mono" style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 620, lineHeight: 1.5 }}>
          Each section can have multiple variants. Build a quant-flavored experience and a full-stack one, then
          mix and match them per role in the Builder.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {SECTION_ORDER.map((kind) => {
          const list = byKind(kind);
          return (
            <div key={kind} className="ff-card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={14} style={{ color: 'var(--ink-3)' }} />
                    <span className="ff-display" style={{ fontSize: 16, fontWeight: 600 }}>{SECTION_TITLE[kind]}</span>
                    <span className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', background: 'var(--paper-3)', padding: '1px 7px', borderRadius: 10 }}>
                      {list.length}
                    </span>
                  </div>
                  <div className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{SECTION_BLURB[kind]}</div>
                </div>
                <button
                  className="ff-btn ff-btn-ghost ff-btn-sm"
                  onClick={() => setEditing({ mode: 'new', kind, label: '', data: emptyDataFor(kind) })}
                >
                  <Plus size={12} /> New
                </button>
              </div>

              {list.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 12, padding: '9px 12px', borderRadius: 3,
                        border: '1px solid var(--line-2)', background: 'var(--paper-2)',
                        opacity: busyId === v.id ? 0.5 : 1,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v.label}</div>
                        <div className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {summarizeVariant(v.kind, v.data)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={() => setEditing({ mode: 'edit', variant: v })}><Pencil size={12} /> Edit</button>
                        <button className="ff-btn ff-btn-ghost ff-btn-sm" title="Duplicate" onClick={() => duplicate(v)}><Copy size={12} /></button>
                        <button className="ff-btn ff-btn-ghost ff-btn-sm" title="Delete" onClick={() => remove(v)}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <VariantEditorModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await onReload(); }}
          onFlash={onFlash}
        />
      )}
    </div>
  );
}
