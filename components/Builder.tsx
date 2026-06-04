'use client';

// ============================================================
// components/Builder.tsx
// ============================================================
// Compose a tailored resume by picking one variant per section,
// reordering sections, and watching a live preview that auto-fits
// to a single page. Export as a faithful PDF or genuine Jake-style
// LaTeX (.tex) source.
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Download, FileText,
  Loader2, ArrowLeft, Pencil, FileCode, AlertCircle, Check,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import {
  SECTION_ORDER, SECTION_TITLE, emptyDataFor, type SectionKind,
} from '@/lib/sections';
import type { SectionVariant } from '@/types/database';
import { type Composition } from '@/lib/resume-render';
import ResumePreview from './ResumePreview';
import VariantEditorModal from './VariantEditorModal';

const NON_HEADER = SECTION_ORDER.filter((k) => k !== 'header');
const slug = (s: string) => (s || 'resume').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'resume';

export default function Builder({
  resumes,
  variants,
  onReload,
  onFlash,
  initialResumeId,
}: {
  resumes: Record<string, any>;
  variants: SectionVariant[];
  onReload: () => Promise<void> | void;
  onFlash: (msg: string, type?: 'success' | 'error') => void;
  initialResumeId?: string | null;
}) {
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editId, setEditId] = useState<string | null>(null);

  // editor state
  const [name, setName] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [order, setOrder] = useState<SectionKind[]>(NON_HEADER);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [loadingComp, setLoadingComp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<'' | 'pdf' | 'tex'>('');
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState<{ fits: boolean; pages: number; scale: number }>({ fits: true, pages: 1, scale: 1 });
  const [quickNew, setQuickNew] = useState<SectionKind | null>(null);

  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const byKind = (kind: SectionKind) => variants.filter((v) => v.kind === kind);

  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) { window.location.href = '/login'; return; }
    setError(e instanceof Error ? e.message : 'Something went wrong');
  };

  // ---- build the composition for the preview ----
  const composition: Composition = useMemo(() => {
    const comp: Composition = [];
    const header = pick.header && variantById.get(pick.header);
    if (header) comp.push({ kind: 'header', title: SECTION_TITLE.header, data: header.data });
    for (const k of order) {
      const v = pick[k] && variantById.get(pick[k]);
      if (v) comp.push({ kind: k, title: SECTION_TITLE[k], data: v.data });
    }
    return comp;
  }, [pick, order, variantById]);

  const orderedVariantIds = useMemo(() => {
    const ids: string[] = [];
    if (pick.header) ids.push(pick.header);
    for (const k of order) if (pick[k]) ids.push(pick[k]);
    return ids;
  }, [pick, order]);

  // ---- start a fresh composition ----
  const startNew = () => {
    setEditId(null);
    setName('');
    setTagsStr('');
    setOrder(NON_HEADER);
    // preselect the first variant of each kind that has exactly one option,
    // so the user starts from something rather than nothing.
    const initial: Record<string, string> = {};
    for (const k of SECTION_ORDER) {
      const list = byKind(k);
      if (list.length === 1) initial[k] = list[0].id;
    }
    setPick(initial);
    setError(null);
    setMode('edit');
  };

  // ---- open an existing composition ----
  const openExisting = async (id: string) => {
    setEditId(id);
    setMode('edit');
    setError(null);
    setLoadingComp(true);
    try {
      const { resume } = await api.resumes.get(id);
      setName(resume.name);
      setTagsStr((resume.tags || []).join(', '));
      const secs = resume.sections || [];
      const nextPick: Record<string, string> = {};
      const present: SectionKind[] = [];
      for (const v of secs) {
        nextPick[v.kind] = v.id;
        if (v.kind !== 'header' && !present.includes(v.kind)) present.push(v.kind);
      }
      // ordered = sections present (in saved order) then the rest
      const rest = NON_HEADER.filter((k) => !present.includes(k));
      setOrder([...present, ...rest]);
      setPick(nextPick);
    } catch (e) { handleError(e); }
    finally { setLoadingComp(false); }
  };

  useEffect(() => {
    if (initialResumeId) openExisting(initialResumeId);
  // openExisting is stable across renders (no deps change it)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialResumeId]);

  const setVariant = (kind: SectionKind, variantId: string) =>
    setPick((p) => ({ ...p, [kind]: variantId }));

  const moveKind = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  // ---- persist; returns the saved id (or null on failure) ----
  const save = async (): Promise<string | null> => {
    if (!name.trim()) { setError('Name your resume first.'); return null; }
    setSaving(true);
    setError(null);
    const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      if (editId) {
        await api.resumes.update(editId, { name: name.trim(), tags, sections: orderedVariantIds });
        await onReload();
        onFlash('Resume saved');
        return editId;
      } else {
        const created = await api.resumes.create({ name: name.trim(), tags, sections: orderedVariantIds });
        setEditId(created.id);
        await onReload();
        onFlash(`Created "${name.trim()}"`);
        return created.id;
      }
    } catch (e) { handleError(e); return null; }
    finally { setSaving(false); }
  };

  // ---- export (saves first so the server renders the latest) ----
  const exportPdf = async () => {
    setExporting('pdf');
    setError(null);
    try {
      const id = await save();
      if (!id) return;
      const html = await api.resumes.render(id, 'html', fit.scale || scale);
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const styles = Array.from(doc.head.querySelectorAll('style')).map((s) => s.outerHTML).join('');
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-10000px;top:0;width:8.5in;';
      container.innerHTML = styles + doc.body.innerHTML;
      document.body.appendChild(container);
      try {
        const html2pdf = (await import('html2pdf.js')).default;
        const opts: Record<string, unknown> = {
          margin: 0,
          filename: `${slug(name)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        };
        await html2pdf().from(container).set(opts).save();
      } finally { document.body.removeChild(container); }
    } catch (e: any) {
      handleError(e);
    } finally { setExporting(''); }
  };

  const exportTex = async () => {
    setExporting('tex');
    setError(null);
    try {
      const id = await save();
      if (!id) return;
      const tex = await api.resumes.render(id, 'tex');
      const blob = new Blob([tex], { type: 'application/x-tex' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug(name)}.tex`;
      a.click();
      URL.revokeObjectURL(url);
      onFlash('Downloaded .tex — compile on Overleaf for an exact match');
    } catch (e: any) {
      handleError(e);
    } finally { setExporting(''); }
  };

  // ---------------------------------------------------------
  // LIST MODE
  // ---------------------------------------------------------
  if (mode === 'list') {
    const list = Object.values(resumes).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22 }}>
          <div>
            <div className="ff-mono ff-label" style={{ color: 'var(--accent-2)', fontSize: 11 }}>Builder</div>
            <h1 className="ff-display" style={{ fontSize: 26, fontWeight: 500, margin: '6px 0 4px' }}>Tailored resumes</h1>
            <div className="ff-mono" style={{ fontSize: 12, color: 'var(--ink-3)', maxWidth: 600, lineHeight: 1.5 }}>
              Assemble a resume from your section variants. Each one auto-fits to a single ATS-friendly page.
            </div>
          </div>
          <button className="ff-btn" onClick={startNew}><Plus size={13} /> New resume</button>
        </div>

        {variants.length === 0 && (
          <div className="ff-card" style={{ padding: 20, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
            <AlertCircle size={15} style={{ color: 'var(--amber, #d97706)' }} />
            <span className="ff-mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              You have no section variants yet. Head to the Section Library to create your header, experience, etc. first.
            </span>
          </div>
        )}

        {(list as any[]).length === 0 ? (
          <div className="ff-card" style={{ padding: 40, textAlign: 'center' }}>
            <FileText size={26} style={{ color: 'var(--ink-3)' }} />
            <div className="ff-display" style={{ fontSize: 18, marginTop: 12, fontWeight: 500 }}>No resumes yet</div>
            <div className="ff-mono" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>Compose your first tailored resume.</div>
            <button className="ff-btn" style={{ marginTop: 18 }} onClick={startNew}><Plus size={13} /> New resume</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(list as any[]).map((r) => (
              <div key={r.id} className="ff-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</div>
                  <div className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {(r.tags || []).length ? (r.tags as string[]).join(' · ') : 'no tags'}
                  </div>
                </div>
                <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={() => openExisting(r.id)}><Pencil size={12} /> Open</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------
  // EDIT MODE
  // ---------------------------------------------------------
  const rowsToRender: SectionKind[] = ['header', ...order];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={() => { setMode('list'); }}>
          <ArrowLeft size={13} /> All resumes
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={exportTex} disabled={!!exporting || saving}>
            {exporting === 'tex' ? <><Loader2 size={12} style={{ animation: 'spin 1.2s linear infinite' }} /> …</> : <><FileCode size={12} /> .tex</>}
          </button>
          <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={exportPdf} disabled={!!exporting || saving}>
            {exporting === 'pdf' ? <><Loader2 size={12} style={{ animation: 'spin 1.2s linear infinite' }} /> …</> : <><Download size={12} /> PDF</>}
          </button>
          <button className="ff-btn ff-btn-sm" onClick={save} disabled={saving || !!exporting || !name.trim()}>
            {saving ? <><Loader2 size={12} style={{ animation: 'spin 1.2s linear infinite' }} /> Saving…</> : <><Check size={12} /> Save</>}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* ---- left: compose ---- */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Resume name</label>
              <input className="ff-input" value={name} placeholder="SWE — Stripe" autoFocus onChange={(e) => setName(e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Tags</label>
              <input className="ff-input" value={tagsStr} placeholder="swe, fintech" onChange={(e) => setTagsStr(e.target.value)} />
            </div>
          </div>

          {loadingComp ? (
            <div className="ff-mono" style={{ fontSize: 12, color: 'var(--ink-3)', padding: 20, textAlign: 'center' }}>
              <Loader2 size={14} style={{ animation: 'spin 1.2s linear infinite' }} /> Loading composition…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="ff-mono ff-label" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Sections — pick a variant for each</div>
              {rowsToRender.map((kind) => {
                const isHeader = kind === 'header';
                const i = isHeader ? -1 : order.indexOf(kind);
                const list = byKind(kind);
                const selected = pick[kind] || '';
                return (
                  <div
                    key={kind}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                      border: '1px solid var(--line-2)', borderRadius: 3,
                      background: selected ? 'var(--paper-2)' : 'var(--paper)',
                    }}
                  >
                    {/* reorder (not for header) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, width: 20, flexShrink: 0 }}>
                      {!isHeader && (
                        <>
                          <button title="Up" disabled={i <= 0} onClick={() => moveKind(i, -1)} style={ghostArrow}><ChevronUp size={12} /></button>
                          <button title="Down" disabled={i >= order.length - 1} onClick={() => moveKind(i, 1)} style={ghostArrow}><ChevronDown size={12} /></button>
                        </>
                      )}
                    </div>
                    <div style={{ width: 120, flexShrink: 0, fontSize: 13, fontWeight: 600 }}>
                      {SECTION_TITLE[kind]}
                      {isHeader && <span className="ff-mono" style={{ fontSize: 9, color: 'var(--ink-3)', display: 'block', fontWeight: 400 }}>always first</span>}
                    </div>
                    {list.length === 0 ? (
                      <span className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)', flex: 1 }}>No variants — create one →</span>
                    ) : (
                      <select className="ff-select" style={{ flex: 1, minWidth: 0 }} value={selected} onChange={(e) => setVariant(kind, e.target.value)}>
                        <option value="">— not included —</option>
                        {list.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                      </select>
                    )}
                    <button className="ff-btn ff-btn-ghost ff-btn-sm" title={`New ${SECTION_TITLE[kind]} variant`} style={{ flexShrink: 0 }} onClick={() => setQuickNew(kind)}>
                      <Plus size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="ff-mono" style={{ fontSize: 11.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </div>

        {/* ---- right: live preview ---- */}
        <div style={{ width: 480, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="ff-mono ff-label" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>Live preview</span>
            <FitBadge fit={fit} empty={composition.length === 0} />
          </div>
          <div style={{ background: 'var(--paper-3)', border: '1px solid var(--line-2)', borderRadius: 4, padding: 16, display: 'flex', justifyContent: 'center' }}>
            {composition.length === 0 ? (
              <div className="ff-mono" style={{ fontSize: 12, color: 'var(--ink-3)', padding: '120px 0', textAlign: 'center' }}>
                Pick a few sections to see your resume.
              </div>
            ) : (
              <ResumePreview composition={composition} width={448} onScale={setScale} onFit={setFit} />
            )}
          </div>
        </div>
      </div>

      {quickNew && (
        <VariantEditorModal
          initial={{ mode: 'new', kind: quickNew, label: '', data: emptyDataFor(quickNew) }}
          onClose={() => setQuickNew(null)}
          onSaved={async () => { setQuickNew(null); await onReload(); }}
          onFlash={onFlash}
        />
      )}
    </div>
  );
}

const ghostArrow: React.CSSProperties = {
  border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)',
  padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function FitBadge({ fit, empty }: { fit: { fits: boolean; pages: number; scale: number }; empty: boolean }) {
  if (empty) return null;
  const pct = Math.round(fit.scale * 100);
  if (fit.fits) {
    return (
      <span className="ff-mono" style={{ fontSize: 10.5, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}>
        <Check size={12} /> Fits one page{pct < 100 ? ` · scaled to ${pct}%` : ''}
      </span>
    );
  }
  return (
    <span className="ff-mono" style={{ fontSize: 10.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 5 }}>
      <AlertCircle size={12} /> Over one page even at {pct}% — trim content
    </span>
  );
}
