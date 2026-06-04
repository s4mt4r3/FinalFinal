'use client';

// ============================================================
// components/VariantEditorModal.tsx
// ============================================================
// Modal wrapper around the guided SectionEditor: a label for the
// variant ("Quant-focused experience") plus the structured slots,
// with create/update wired to the API.
// ============================================================

import { useState } from 'react';
import { X, Loader2, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { SECTION_TITLE, type SectionKind } from '@/lib/sections';
import type { SectionVariant } from '@/types/database';
import SectionEditor from './SectionEditor';

type Initial =
  | { mode: 'new'; kind: SectionKind; label: string; data: any }
  | { mode: 'edit'; variant: SectionVariant };

export default function VariantEditorModal({
  initial,
  onClose,
  onSaved,
  onFlash,
}: {
  initial: Initial;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onFlash: (msg: string, type?: 'success' | 'error') => void;
}) {
  const kind = initial.mode === 'new' ? initial.kind : initial.variant.kind;
  const [label, setLabel] = useState(initial.mode === 'new' ? initial.label : initial.variant.label);
  const [data, setData] = useState<any>(initial.mode === 'new' ? initial.data : initial.variant.data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!label.trim()) { setError('Give this variant a name.'); return; }
    setBusy(true);
    setError(null);
    try {
      if (initial.mode === 'new') {
        await api.sections.create({ kind, label: label.trim(), data });
      } else {
        await api.sections.update(initial.variant.id, { label: label.trim(), data });
      }
      onFlash(initial.mode === 'new' ? 'Variant created' : 'Variant saved');
      await onSaved();
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
      setError(e?.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ff-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="ff-modal ff-modal-wide">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 28px 14px', borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="ff-mono ff-label" style={{ color: 'var(--accent-2)', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={12} /> {SECTION_TITLE[kind]} variant
            </div>
            <div className="ff-display" style={{ fontSize: 20, fontWeight: 500, marginTop: 4 }}>
              {initial.mode === 'new' ? 'New variant' : 'Edit variant'}
            </div>
          </div>
          <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={onClose} disabled={busy}><X size={14} /></button>
        </div>

        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.3 }}>Variant name</label>
            <input
              className="ff-input"
              value={label}
              autoFocus
              placeholder="e.g. Quant-focused, Full-stack, Default"
              onChange={(e) => setLabel(e.target.value)}
            />
            <span className="ff-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>Only you see this — it labels the block in your library and the builder.</span>
          </div>

          <div style={{ borderTop: '1px dashed var(--line-2)', paddingTop: 16 }}>
            <SectionEditor kind={kind} data={data} onChange={setData} />
          </div>

          {error && (
            <div className="ff-mono" style={{ fontSize: 11.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>{error}</div>
          )}
        </div>

        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--paper-2)' }}>
          <button className="ff-btn ff-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="ff-btn" onClick={save} disabled={busy || !label.trim()}>
            {busy ? <><Loader2 size={13} style={{ animation: 'spin 1.2s linear infinite' }} /> Saving…</> : 'Save variant'}
          </button>
        </div>
      </div>
    </div>
  );
}
