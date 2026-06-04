'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitBranch, FileText, BarChart3, Briefcase, GitCompare,
  Plus, X, Edit3, Trash2, Download, ChevronRight, ChevronDown,
  Calendar, Tag, AlertCircle, Check, Loader2, GitCommit,
  ArrowRight, Search, MoreHorizontal, Copy, ExternalLink,
  Sparkles, TrendingUp, FileCheck, Hash, Clock, Layers,
  RefreshCw, MessageSquare, Filter, LogOut, Upload, Eye, Info
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import Builder from './Builder';
import SectionLibrary from './SectionLibrary';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  Cell, PieChart, Pie, CartesianGrid
} from 'recharts';

/* ----------------------------- utilities ----------------------------- */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const fmtDate = (ts: number) => {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
};

const fmtDateLong = (ts: number) => new Date(ts).toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
});

const shortHash = (id: string) => id.slice(0, 7);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');


/* ----------------------------- data loading ----------------------------- */

async function loadData() {
  const [resumes, variants, applications, interviews] = await Promise.all([
    api.resumes.list(),
    api.sections.list().catch(() => []),
    api.applications.list(),
    api.interviews.list().catch(() => []),
  ]);

  const resumesObj = Object.fromEntries(
    resumes.map((r: any) => [
      r.id,
      {
        ...r,
        parentId: r.parent_id,
        createdAt: new Date(r.created_at).getTime(),
      },
    ])
  );

  const applicationsObj = Object.fromEntries(
    applications.map((a: any) => [
      a.id,
      {
        ...a,
        resumeId: a.resume_id,
        dateApplied: new Date(a.date_applied).getTime(),
      },
    ])
  );

  const interviewsByApp: Record<string, any[]> = {};
  for (const iv of interviews as any[]) {
    (interviewsByApp[iv.application_id] ||= []).push({
      ...iv,
      applicationId: iv.application_id,
      scheduledAt: iv.scheduled_at ? new Date(iv.scheduled_at).getTime() : null,
    });
  }

  return {
    resumes: resumesObj,
    variants,
    applications: applicationsObj,
    interviewsByApp,
    version: 1,
  };
}

/* ----------------------------- styles ----------------------------- */

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;0,9..144,900;1,9..144,400;1,9..144,500&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  :root {
    --paper: #F5F0E6;
    --paper-2: #EFE9DB;
    --paper-3: #E8E1D0;
    --ink: #1A1815;
    --ink-2: #3A3631;
    --ink-3: #6B6459;
    --line: #D9D0BC;
    --line-2: #C9BFA7;
    --accent: #B8451F;
    --accent-2: #9C3A18;
    --accent-soft: #F0D9CC;
    --green: #2E6A4A;
    --green-soft: #D4E5D8;
    --red: #A0322B;
    --red-soft: #F0D5D2;
    --amber: #A87B1F;
    --amber-soft: #EFE0BE;
    --blue: #2B5573;
    --blue-soft: #D5E0EA;
  }
  .ff-app, .ff-app * {
    font-family: 'Fraunces', Georgia, serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .ff-mono, .ff-mono * { font-family: 'IBM Plex Mono', ui-monospace, monospace !important; }
  .ff-app {
    background: var(--paper);
    color: var(--ink);
    font-feature-settings: "ss01", "ss02";
  }
  .ff-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; font-variation-settings: "opsz" 144, "SOFT" 50; letter-spacing: -0.02em; }
  .ff-italic { font-style: italic; font-variation-settings: "opsz" 144, "SOFT" 100; }
  .ff-label { font-family: 'IBM Plex Mono', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 500; }
  .ff-tabular { font-variant-numeric: tabular-nums; }

  .ff-paper {
    background-color: var(--paper);
    background-image:
      radial-gradient(rgba(60,40,20,0.025) 1px, transparent 1px),
      radial-gradient(rgba(60,40,20,0.018) 1px, transparent 1px);
    background-size: 24px 24px, 47px 47px;
    background-position: 0 0, 12px 23px;
  }

  .ff-card {
    background: var(--paper-2);
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .ff-card-raised {
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: 4px;
    box-shadow: 0 1px 0 rgba(60,40,20,0.04), 0 8px 24px -16px rgba(60,40,20,0.18);
  }

  .ff-btn {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 500;
    padding: 9px 16px;
    border-radius: 3px;
    border: 1px solid var(--ink);
    background: var(--ink);
    color: var(--paper);
    cursor: pointer;
    transition: all 120ms ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .ff-btn:hover { background: var(--accent); border-color: var(--accent); }
  .ff-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ff-btn:disabled:hover { background: var(--ink); border-color: var(--ink); }
  .ff-btn-ghost {
    background: transparent;
    color: var(--ink);
    border-color: var(--line-2);
  }
  .ff-btn-ghost:hover { background: var(--paper-3); border-color: var(--ink-3); color: var(--ink); }
  .ff-btn-danger { border-color: var(--red); background: transparent; color: var(--red); }
  .ff-btn-danger:hover { background: var(--red); color: var(--paper); border-color: var(--red); }
  .ff-btn-sm { padding: 5px 10px; font-size: 10px; }

  .ff-input, .ff-textarea, .ff-select {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 13px;
    background: var(--paper);
    border: 1px solid var(--line-2);
    border-radius: 3px;
    padding: 9px 12px;
    color: var(--ink);
    width: 100%;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .ff-input:focus, .ff-textarea:focus, .ff-select:focus {
    border-color: var(--ink);
    box-shadow: 0 0 0 3px rgba(184,69,31,0.12);
  }
  .ff-input:disabled, .ff-textarea:disabled, .ff-select:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .ff-textarea { font-size: 12.5px; line-height: 1.55; resize: vertical; min-height: 280px; }

  .ff-chip {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 2px;
    border: 1px solid var(--line-2);
    background: var(--paper);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--ink-2);
  }

  .ff-status-applied { background: var(--blue-soft); color: var(--blue); border-color: var(--blue); }
  .ff-status-interviewing { background: var(--amber-soft); color: var(--amber); border-color: var(--amber); }
  .ff-status-offer { background: var(--green-soft); color: var(--green); border-color: var(--green); }
  .ff-status-rejected { background: var(--red-soft); color: var(--red); border-color: var(--red); }
  .ff-status-ghosted { background: var(--paper-3); color: var(--ink-3); border-color: var(--line-2); }

  .ff-diff-line { padding: 2px 12px 2px 36px; position: relative; min-height: 1.6em; }
  .ff-diff-same { color: var(--ink-2); }
  .ff-diff-added { background: var(--green-soft); color: var(--green); }
  .ff-diff-added::before { content: '+'; position: absolute; left: 16px; opacity: 0.7; }
  .ff-diff-removed { background: var(--red-soft); color: var(--red); }
  .ff-diff-removed::before { content: '−'; position: absolute; left: 16px; opacity: 0.7; }

  .ff-nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 3px;
    cursor: pointer;
    color: var(--ink-2);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.05em;
    transition: all 120ms ease;
    border: 1px solid transparent;
  }
  .ff-nav-item:hover { background: var(--paper-3); color: var(--ink); }
  .ff-nav-item-active {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }
  .ff-nav-item-active:hover { background: var(--ink); color: var(--paper); }

  @keyframes ff-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .ff-fade { animation: ff-fade 280ms ease-out both; }
  .ff-fade-delayed { animation: ff-fade 280ms ease-out 80ms both; }

  .ff-link { color: var(--accent); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 3px; cursor: pointer; }
  .ff-link:hover { color: var(--accent-2); }

  .ff-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
  .ff-scroll::-webkit-scrollbar-track { background: transparent; }
  .ff-scroll::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 4px; }
  .ff-scroll::-webkit-scrollbar-thumb:hover { background: var(--ink-3); }

  .ff-modal-backdrop {
    position: fixed; inset: 0;
    background: rgba(26,24,21,0.45);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 50;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 64px 20px 20px;
    animation: ff-fade 180ms ease-out both;
  }
  .ff-modal {
    background: var(--paper);
    border: 1px solid var(--ink);
    border-radius: 4px;
    width: 100%;
    max-width: 640px;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    box-shadow: 0 20px 60px -20px rgba(0,0,0,0.4);
  }
  .ff-modal-wide { max-width: 880px; }
  .ff-modal-xwide { max-width: 1040px; }
`;

/* ----------------------------- icon helper ----------------------------- */
const StatusDot = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    applied: 'var(--blue)',
    interviewing: 'var(--amber)',
    offer: 'var(--green)',
    rejected: 'var(--red)',
    ghosted: 'var(--ink-3)',
  };
  return <span style={{ width: 7, height: 7, borderRadius: '50%', background: map[status] || 'var(--ink-3)', display: 'inline-block' }} />;
};

const StatusChip = ({ status }: { status: string }) => (
  <span className={`ff-chip ff-mono ff-status-${status}`}>{status}</span>
);

/* ===================================================================
   COMPONENTS
   =================================================================== */

const App = () => {
  const router = useRouter();
  const [data, setData] = useState<any>({ resumes: {}, variants: [], applications: {}, interviewsByApp: {} });
  const [view, setView] = useState('dashboard');
  const [builderResumeId, setBuilderResumeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [submitting, setSubmitting] = useState(false);

  const signOut = async () => {
    await api.auth.signOut();
    router.push('/login');
  };

  const flash = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastType(type);
    setToast(msg);
    setTimeout(() => setToast(null), type === 'error' ? 3500 : 2400);
  };

  const handleError = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      window.location.href = '/login';
      return;
    }
    flash(e instanceof Error ? e.message : 'Something went wrong', 'error');
  };

  useEffect(() => {
    (async () => {
      try {
        const existing = await loadData();
        setData(existing);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          window.location.href = '/login';
          return;
        }
        setData({ resumes: {}, variants: [], applications: {}, interviewsByApp: {}, version: 1 });
        flash(e instanceof Error ? e.message : 'Failed to load data', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const reloadData = async () => {
    const existing = await loadData();
    setData(existing);
  };

  const createApplication = async (app: any) => {
    setSubmitting(true);
    try {
      await api.applications.create({
        company: app.company,
        role: app.role,
        status: app.status,
        notes: app.notes || '',
        resume_id: app.resumeId || null,
        date_applied: app.dateApplied ? new Date(app.dateApplied).toISOString() : new Date().toISOString(),
      });
      await reloadData();
      flash(`Tracked application to ${app.company}`);
    } catch (e) {
      handleError(e);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const updateApplication = async (id: string, patch: any) => {
    const updatePayload: any = {};
    if (patch.company !== undefined) updatePayload.company = patch.company;
    if (patch.role !== undefined) updatePayload.role = patch.role;
    if (patch.status !== undefined) updatePayload.status = patch.status;
    if (patch.notes !== undefined) updatePayload.notes = patch.notes;
    if (patch.resumeId !== undefined) updatePayload.resume_id = patch.resumeId;
    if (patch.dateApplied !== undefined) updatePayload.date_applied = patch.dateApplied;

    setSubmitting(true);
    try {
      await api.applications.update(id, updatePayload);
      await reloadData();
    } catch (e) {
      handleError(e);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const deleteApplication = async (id: string) => {
    setSubmitting(true);
    try {
      await api.applications.delete(id);
      await reloadData();
      flash('Application removed');
    } catch (e) {
      handleError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const wipe = async () => {
    const allResumes = Object.keys(data.resumes);
    const allApps = Object.keys(data.applications);
    const allVariants = (data.variants as any[]).map((v) => v.id);

    setSubmitting(true);
    try {
      for (const appId of allApps) {
        await api.applications.delete(appId);
      }
      for (const resumeId of allResumes) {
        await api.resumes.delete(resumeId);
      }
      for (const variantId of allVariants) {
        await api.sections.delete(variantId);
      }

      await reloadData();
      flash('All data cleared');
    } catch (e) {
      handleError(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="ff-app ff-paper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{STYLES}</style>
        <div style={{ textAlign: 'center', color: 'var(--ink-3)' }}>
          <Loader2 size={28} style={{ animation: 'spin 1.2s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div className="ff-mono ff-label" style={{ marginTop: 14, fontSize: 11 }}>Loading versions…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ff-app ff-paper" style={{ minHeight: '100vh' }}>
      <style>{STYLES}</style>

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{
          width: 240, flexShrink: 0, borderRight: '1px solid var(--line)',
          padding: '28px 18px', position: 'sticky', top: 0, height: '100vh',
          background: 'var(--paper-2)', overflowY: 'auto'
        }} className="ff-scroll">
          <div style={{ marginBottom: 36 }}>
            <div className="ff-display" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.03em' }}>
              Final<span style={{ color: 'var(--accent)' }} className="ff-italic">Final</span>
            </div>
            <div className="ff-mono ff-label" style={{ marginTop: 6, color: 'var(--ink-3)' }}>
              v1.0 · resume composer
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <NavItem icon={<BarChart3 size={15} />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavItem icon={<FileText size={15} />} label="Builder" active={view === 'builder'} onClick={() => { setBuilderResumeId(null); setView('builder'); }} />
            <NavItem icon={<Layers size={15} />} label="Sections" active={view === 'sections'} onClick={() => setView('sections')} />
            <NavItem icon={<Briefcase size={15} />} label="Applications" active={view === 'applications'} onClick={() => setView('applications')} />
            <NavItem icon={<TrendingUp size={15} />} label="Analytics" active={view === 'analytics'} onClick={() => setView('analytics')} />
          </nav>

          <div style={{ marginTop: 36 }}>
            <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 12, paddingLeft: 14 }}>
              At a glance
            </div>
            <Glance data={data} />
          </div>

          <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <button className="ff-btn ff-btn-ghost ff-btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={signOut}>
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0, padding: '40px 56px 80px' }}>
          {view === 'dashboard' && (
            <Dashboard
              data={data}
              setView={setView}
              openModal={setModal}
              submitting={submitting}
              onOpenResume={(id: string) => { setBuilderResumeId(id); setView('builder'); }}
            />
          )}
          {view === 'builder' && (
            <Builder
              resumes={data.resumes}
              variants={data.variants}
              onReload={reloadData}
              onFlash={flash}
              initialResumeId={builderResumeId}
            />
          )}
          {view === 'sections' && (
            <SectionLibrary
              variants={data.variants}
              onReload={reloadData}
              onFlash={flash}
            />
          )}
          {view === 'applications' && (
            <Applications
              data={data}
              openModal={setModal}
              deleteApplication={deleteApplication}
              submitting={submitting}
            />
          )}
          {view === 'analytics' && (
            <Analytics data={data} />
          )}
        </main>
      </div>

      {/* Modals */}
      {modal && (
        <ModalRouter
          modal={modal}
          close={() => setModal(null)}
          data={data}
          createApplication={createApplication}
          updateApplication={updateApplication}
          wipe={wipe}
          submitting={submitting}
          reloadData={reloadData}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: toastType === 'error' ? 'var(--red)' : 'var(--ink)',
          color: 'var(--paper)',
          padding: '10px 18px', borderRadius: 3,
          fontSize: 12, zIndex: 100,
          animation: 'ff-fade 200ms ease-out',
          boxShadow: '0 8px 24px -8px rgba(0,0,0,0.3)'
        }} className="ff-mono">
          {toastType === 'error'
            ? <AlertCircle size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 8 }} />
            : <Check size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 8 }} />
          }
          {toast}
        </div>
      )}
    </div>
  );
};

/* ----------------------------- nav item ----------------------------- */
const NavItem = ({ icon, label, active, onClick }: any) => (
  <div className={`ff-nav-item ${active ? 'ff-nav-item-active' : ''}`} onClick={onClick}>
    {icon}
    <span>{label}</span>
    {active && <ChevronRight size={13} style={{ marginLeft: 'auto' }} />}
  </div>
);

const Glance = ({ data }: any) => {
  const resumeCount = Object.keys(data.resumes).length;
  const variantCount = (data.variants || []).length;
  const appCount = Object.keys(data.applications).length;
  return (
    <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Stat n={resumeCount} label="resumes" />
      <Stat n={variantCount} label="section variants" />
      <Stat n={appCount} label="applications" accent />
    </div>
  );
};

const Stat = ({ n, label, accent }: any) => (
  <div>
    <div className="ff-display ff-tabular" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1, color: accent ? 'var(--accent)' : 'var(--ink)' }}>
      {n.toString().padStart(2, '0')}
    </div>
    <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
  </div>
);

/* ===================================================================
   DASHBOARD
   =================================================================== */

const Dashboard = ({ data, setView, openModal, submitting, onOpenResume }: any) => {
  const resumes = Object.values(data.resumes).sort((a: any, b: any) => b.createdAt - a.createdAt);
  const apps = Object.values(data.applications).sort((a: any, b: any) => b.dateApplied - a.dateApplied);
  const recent = resumes.slice(0, 4);
  const recentApps = apps.slice(0, 5);

  const stats = computeVersionStats(data);
  const best = stats.filter((s: any) => s.applied >= 2).sort((a: any, b: any) => b.callbackRate - a.callbackRate)[0];

  return (
    <div className="ff-fade">
      <Header
        kicker="Overview"
        title="Welcome back."
        subtitle="Compose tailored resumes from reusable sections, track applications, and see what's working."
        action={
          <button className="ff-btn" onClick={() => setView('builder')} disabled={submitting}>
            <Plus size={13} /> New resume
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 36 }}>
        <BigStat label="Resumes" value={Object.keys(data.resumes).length} sub="tailored compositions" />
        <BigStat label="Section variants" value={(data.variants || []).length} sub="in your library" />
        <BigStat label="Applications" value={Object.keys(data.applications).length} sub="this cycle" />
        <BigStat label="Active leads" value={(apps as any[]).filter((a: any) => a.status === 'interviewing').length} sub="interviewing" accent />
      </div>

      {best && (
        <div className="ff-card-raised ff-fade-delayed" style={{ marginTop: 32, padding: 28, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)',
            opacity: 0.6
          }} />
          <div style={{ position: 'relative' }}>
            <div className="ff-mono ff-label" style={{ color: 'var(--accent)', marginBottom: 10 }}>
              <Sparkles size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 6 }} />
              What's working
            </div>
            <div className="ff-display" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              <span className="ff-italic">"{best.name}"</span> is your highest-performing resume.
            </div>
            <div style={{ color: 'var(--ink-2)', marginTop: 12, fontSize: 15, lineHeight: 1.6 }}>
              {best.applied} applications sent, {best.callbacks} callback{best.callbacks === 1 ? '' : 's'} — a{' '}
              <span className="ff-mono ff-tabular" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                {Math.round(best.callbackRate * 100)}%
              </span>{' '}
              response rate.
            </div>
            <button
              className="ff-btn ff-btn-ghost"
              style={{ marginTop: 18 }}
              onClick={() => onOpenResume(best.id)}
            >
              Open in builder <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, marginTop: 32 }}>
        <div>
          <SectionHeader title="Recent resumes" onAction={() => setView('builder')} actionLabel="All resumes" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {recent.length === 0 && <EmptyHint text="No resumes yet. Build your sections, then compose one." />}
            {(recent as any[]).map((r: any) => (
              <div key={r.id} className="ff-card" onClick={() => onOpenResume(r.id)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                <FileText size={15} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{r.name}</div>
                  <div className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {fmtDate(r.createdAt)}
                  </div>
                </div>
                {r.tags && r.tags.map((t: string) => <span key={t} className="ff-chip">{t}</span>)}
                <ArrowRight size={12} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <SectionHeader title="Recent applications" onAction={() => setView('applications')} actionLabel="All applications" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {recentApps.length === 0 && <EmptyHint text="No applications tracked yet." />}
            {(recentApps as any[]).map((a: any) => {
              const r = a.resumeId && data.resumes[a.resumeId];
              return (
                <div key={a.id} className="ff-card" onClick={() => openModal({ type: 'editApplication', payload: a })} style={{ padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusDot status={a.status} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{a.company}</div>
                      <div className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        {a.role} · {fmtDate(a.dateApplied)}
                      </div>
                    </div>
                    <StatusChip status={a.status} />
                    <ArrowRight size={12} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                  </div>
                  {r && (
                    <div className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 8, paddingLeft: 17 }}>
                      <FileText size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 5 }} />
                      using <span style={{ color: 'var(--ink)' }}>{r.name}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const Header = ({ kicker, title, subtitle, action }: any) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
    <div>
      <div className="ff-mono ff-label" style={{ color: 'var(--accent)', marginBottom: 10 }}>{kicker}</div>
      <h1 className="ff-display" style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1, margin: 0 }}>
        {title}
      </h1>
      {subtitle && <div style={{ color: 'var(--ink-3)', marginTop: 14, fontSize: 15, maxWidth: 560 }}>{subtitle}</div>}
    </div>
    {action}
  </div>
);

const SectionHeader = ({ title, onAction, actionLabel }: any) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
    <h2 className="ff-display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>{title}</h2>
    {onAction && (
      <button className="ff-link ff-mono" style={{ background: 'none', border: 'none', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }} onClick={onAction}>
        {actionLabel} →
      </button>
    )}
  </div>
);

const BigStat = ({ label, value, sub, accent }: any) => (
  <div className="ff-card" style={{ padding: '20px 22px' }}>
    <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>{label}</div>
    <div className="ff-display ff-tabular" style={{ fontSize: 44, fontWeight: 500, lineHeight: 1, marginTop: 8, color: accent ? 'var(--accent)' : 'var(--ink)', letterSpacing: '-0.03em' }}>
      {typeof value === 'number' ? value.toString().padStart(2, '0') : value}
    </div>
    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>{sub}</div>
  </div>
);

const EmptyHint = ({ text }: any) => (
  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic' }}>
    {text}
  </div>
);

/* ===================================================================
   APPLICATIONS
   =================================================================== */

const Applications = ({ data, openModal, deleteApplication, submitting }: any) => {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const apps = Object.values(data.applications)
    .filter((a: any) => filter === 'all' || a.status === filter)
    .filter((a: any) => !search || a.company.toLowerCase().includes(search.toLowerCase()) || (a.role || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => b.dateApplied - a.dateApplied);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, applied: 0, interviewing: 0, offer: 0, rejected: 0, ghosted: 0 };
    for (const a of Object.values(data.applications) as any[]) {
      c.all++;
      c[a.status] = (c[a.status] || 0) + 1;
    }
    return c;
  }, [data.applications]);

  const filters = ['all', 'applied', 'interviewing', 'offer', 'rejected', 'ghosted'];

  return (
    <div className="ff-fade">
      <Header
        kicker="Applications"
        title="Where you've applied."
        subtitle="Every application linked to a specific resume version, so you know what's working."
        action={
          <button className="ff-btn" onClick={() => openModal({ type: 'newApplication' })} disabled={submitting}>
            <Plus size={13} /> New application
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 28 }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="ff-mono"
            style={{
              padding: '6px 12px',
              border: '1px solid ' + (filter === f ? 'var(--ink)' : 'var(--line-2)'),
              background: filter === f ? 'var(--ink)' : 'transparent',
              color: filter === f ? 'var(--paper)' : 'var(--ink-2)',
              borderRadius: 2,
              fontSize: 10.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 120ms ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            {f}
            <span className="ff-tabular" style={{ opacity: 0.7 }}>{counts[f] || 0}</span>
          </button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto', minWidth: 240 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)' }} />
          <input
            className="ff-input"
            placeholder="Search company or role…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
      </div>

      <div className="ff-card" style={{ marginTop: 20, overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '24px 1.4fr 1.6fr 1.4fr 120px 100px 110px',
          gap: 16, padding: '12px 22px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--paper-3)',
          alignItems: 'center'
        }}>
          <div></div>
          <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Company</div>
          <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Role</div>
          <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Resume used</div>
          <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Status</div>
          <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Applied</div>
          <div></div>
        </div>

        {apps.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-3)' }}>
            <Briefcase size={24} style={{ opacity: 0.5 }} />
            <div style={{ marginTop: 12, fontSize: 14 }}>No applications match.</div>
          </div>
        ) : (apps as any[]).map((a: any) => {
          const r = a.resumeId && data.resumes[a.resumeId];
          return (
            <div
              key={a.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1.4fr 1.6fr 1.4fr 120px 100px 110px',
                gap: 16, padding: '14px 22px',
                borderBottom: '1px solid var(--line)',
                alignItems: 'center',
                transition: 'background 120ms ease',
                cursor: 'default'
              }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--paper-3)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
            >
              <StatusDot status={a.status} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{a.company}</div>
                {a.notes && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, fontStyle: 'italic' }}>{a.notes.slice(0, 50)}{a.notes.length > 50 ? '…' : ''}</div>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{a.role || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }} className="ff-mono">
                {r ? (
                  <span>
                    {r.name}
                    <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>{shortHash(r.id)}</span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>unlinked</span>
                )}
              </div>
              <StatusChip status={a.status} />
              <div className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{fmtDate(a.dateApplied)}</div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  onClick={() => openModal({ type: 'interviews', payload: a })}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '4px 6px', color: 'var(--ink-2)',
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontFamily: 'IBM Plex Mono, monospace', fontSize: 10,
                  }}
                  title="Interviews"
                  disabled={submitting}
                >
                  <Calendar size={12} />
                  {(data.interviewsByApp?.[a.id]?.length ?? 0) > 0 && (
                    <span className="ff-tabular">{data.interviewsByApp[a.id].length}</span>
                  )}
                </button>
                <button
                  onClick={() => openModal({ type: 'editApplication', payload: a })}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)' }}
                  title="Edit"
                  disabled={submitting}
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => { if (confirm(`Remove ${a.company} application?`)) deleteApplication(a.id); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)' }}
                  title="Delete"
                  disabled={submitting}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ===================================================================
   ANALYTICS
   =================================================================== */

function computeVersionStats(data: any) {
  const out = [];
  for (const r of Object.values(data.resumes) as any[]) {
    const apps = Object.values(data.applications).filter((a: any) => a.resumeId === r.id);
    if (apps.length === 0) continue;
    const applied = apps.length;
    const callbacks = apps.filter((a: any) => a.status === 'interviewing' || a.status === 'offer').length;
    const offers = apps.filter((a: any) => a.status === 'offer').length;
    const callbackRate = applied > 0 ? callbacks / applied : 0;
    out.push({ id: r.id, name: r.name, applied, callbacks, offers, callbackRate });
  }
  return out;
}

const Analytics = ({ data }: any) => {
  const apps = Object.values(data.applications) as any[];
  const total = apps.length;
  const callbacks = apps.filter((a: any) => a.status === 'interviewing' || a.status === 'offer').length;
  const offers = apps.filter((a: any) => a.status === 'offer').length;
  const rejected = apps.filter((a: any) => a.status === 'rejected').length;
  const ghosted = apps.filter((a: any) => a.status === 'ghosted').length;
  const callbackRate = total > 0 ? callbacks / total : 0;

  const versionStats = useMemo(() => computeVersionStats(data).sort((a: any, b: any) => b.callbackRate - a.callbackRate), [data]);

  const statusData = [
    { name: 'Applied', value: apps.filter((a: any) => a.status === 'applied').length, color: '#2B5573' },
    { name: 'Interviewing', value: apps.filter((a: any) => a.status === 'interviewing').length, color: '#A87B1F' },
    { name: 'Offer', value: offers, color: '#2E6A4A' },
    { name: 'Rejected', value: rejected, color: '#A0322B' },
    { name: 'Ghosted', value: ghosted, color: '#8A7E66' },
  ].filter(d => d.value > 0);

  const barData = versionStats.slice(0, 6).map((v: any) => ({
    name: v.name.length > 18 ? v.name.slice(0, 16) + '…' : v.name,
    rate: Math.round(v.callbackRate * 100),
    applied: v.applied,
    callbacks: v.callbacks,
  }));

  return (
    <div className="ff-fade">
      <Header
        kicker="Analytics"
        title="What's actually working."
        subtitle="Callback rates per version, status distribution, and the data behind your recruiting cycle."
      />

      {total === 0 ? (
        <div style={{ marginTop: 60, textAlign: 'center', padding: 40 }}>
          <BarChart3 size={32} style={{ color: 'var(--ink-3)' }} />
          <div className="ff-display" style={{ fontSize: 22, marginTop: 16, fontWeight: 500 }}>No data yet</div>
          <div style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: 14 }}>Track some applications to see analytics here.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 36 }}>
            <BigStat label="Total applications" value={total} sub={`across ${versionStats.length} version${versionStats.length === 1 ? '' : 's'}`} />
            <BigStat label="Callbacks" value={callbacks} sub="interviewing or offers" accent />
            <BigStat label="Response rate" value={`${Math.round(callbackRate * 100)}%`} sub="industry avg: ~10%" />
            <BigStat label="Offers" value={offers} sub={offers > 0 ? 'congrats' : 'still hunting'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, marginTop: 32 }}>
            <div className="ff-card" style={{ padding: 24 }}>
              <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 4 }}>Callback rate by version</div>
              <div className="ff-display" style={{ fontSize: 18, fontWeight: 500, marginBottom: 18 }}>Which versions land interviews</div>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }}
                      axisLine={{ stroke: 'var(--line-2)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fill: 'var(--ink-3)' }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload || !payload.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: 'var(--paper)', border: '1px solid var(--ink)', padding: '10px 14px', fontSize: 12, fontFamily: 'IBM Plex Mono', color: 'var(--ink)' }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.name}</div>
                            <div>{d.callbacks}/{d.applied} callbacks · {d.rate}%</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="rate" radius={[2, 2, 0, 0]}>
                      {barData.map((d, i) => (
                        <Cell key={i} fill={i === 0 ? 'var(--accent)' : 'var(--ink)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>Not enough data yet</div>
              )}
            </div>

            <div className="ff-card" style={{ padding: 24 }}>
              <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 4 }}>Status distribution</div>
              <div className="ff-display" style={{ fontSize: 18, fontWeight: 500, marginBottom: 18 }}>Where things stand</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {statusData.map((d, i) => <Cell key={i} fill={d.color} stroke="var(--paper)" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{ background: 'var(--paper)', border: '1px solid var(--ink)', padding: '8px 12px', fontSize: 12, fontFamily: 'IBM Plex Mono' }}>
                          {d.name}: {d.value}
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {statusData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <div style={{ width: 8, height: 8, background: d.color, borderRadius: 1 }} />
                    <span style={{ color: 'var(--ink-2)' }}>{d.name}</span>
                    <span className="ff-mono ff-tabular" style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 32 }}>
            <SectionHeader title="Performance by version" />
            <div className="ff-card" style={{ marginTop: 14, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 90px 90px 90px 1fr',
                gap: 16, padding: '12px 22px',
                borderBottom: '1px solid var(--line)',
                background: 'var(--paper-3)',
              }}>
                <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Version</div>
                <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', textAlign: 'right' }}>Sent</div>
                <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', textAlign: 'right' }}>Callbacks</div>
                <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', textAlign: 'right' }}>Offers</div>
                <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Rate</div>
              </div>
              {(versionStats as any[]).map((v: any, i: number) => (
                <div key={v.id} style={{
                  display: 'grid', gridTemplateColumns: '2fr 90px 90px 90px 1fr',
                  gap: 16, padding: '14px 22px',
                  borderBottom: '1px solid var(--line)', alignItems: 'center'
                }}>
                  <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {i === 0 && <Sparkles size={12} style={{ color: 'var(--accent)' }} />}
                    {v.name}
                  </div>
                  <div className="ff-mono ff-tabular" style={{ textAlign: 'right' }}>{v.applied}</div>
                  <div className="ff-mono ff-tabular" style={{ textAlign: 'right' }}>{v.callbacks}</div>
                  <div className="ff-mono ff-tabular" style={{ textAlign: 'right', color: v.offers > 0 ? 'var(--green)' : 'var(--ink)' }}>{v.offers}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--paper-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${v.callbackRate * 100}%`,
                        background: i === 0 ? 'var(--accent)' : 'var(--ink)',
                      }} />
                    </div>
                    <span className="ff-mono ff-tabular" style={{ fontSize: 12, minWidth: 38, textAlign: 'right' }}>
                      {Math.round(v.callbackRate * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ===================================================================
   MODALS
   =================================================================== */

const ModalRouter = ({ modal, close, data, createApplication, updateApplication, wipe, submitting, reloadData }: any) => {
  const safeClose = () => { if (!submitting) close(); };
  return (
    <div className="ff-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) safeClose(); }}>
      <div className="ff-modal">
        {modal.type === 'newApplication' && (
          <ApplicationForm
            data={data}
            onSave={async (v: any) => { try { await createApplication(v); close(); } catch {} }}
            onCancel={safeClose}
            submitting={submitting}
          />
        )}
        {modal.type === 'editApplication' && (
          <ApplicationForm
            data={data}
            existing={modal.payload}
            onSave={async (v: any) => { try { await updateApplication(modal.payload.id, v); close(); } catch {} }}
            onCancel={safeClose}
            isEdit
            submitting={submitting}
          />
        )}
        {modal.type === 'matchKeywords' && (
          <MatchKeywordsModal resume={modal.payload} onCancel={safeClose} />
        )}
        {modal.type === 'interviews' && (
          <InterviewsModal
            application={modal.payload}
            data={data}
            onCancel={safeClose}
            onChanged={reloadData}
          />
        )}
      </div>
    </div>
  );
};

const ModalHeader = ({ title, subtitle, onClose }: any) => (
  <div style={{ padding: '22px 28px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
    <div style={{ flex: 1 }}>
      <div className="ff-display" style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</div>
      {subtitle && <div style={{ color: 'var(--ink-3)', marginTop: 4, fontSize: 13 }}>{subtitle}</div>}
    </div>
    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4 }}>
      <X size={18} />
    </button>
  </div>
);

const Field = ({ label, hint, children }: any) => (
  <div>
    <label className="ff-mono ff-label" style={{ color: 'var(--ink-3)', display: 'block', marginBottom: 8 }}>{label}</label>
    {children}
    {hint && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6, fontStyle: 'italic' }}>{hint}</div>}
  </div>
);


const ApplicationForm = ({ data, existing, isEdit, onSave, onCancel, submitting }: any) => {
  const [company, setCompany] = useState(existing?.company || '');
  const [role, setRole] = useState(existing?.role || '');
  const [resumeId, setResumeId] = useState(existing?.resumeId || '');
  const [status, setStatus] = useState(existing?.status || 'applied');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [date, setDate] = useState(
    existing?.dateApplied
      ? new Date(existing.dateApplied).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  );

  const handleSave = () => {
    onSave({
      company: company.trim(),
      role: role.trim(),
      resumeId: resumeId || null,
      status,
      notes,
      dateApplied: new Date(date).getTime(),
    });
  };

  const resumeOptions = Object.values(data.resumes).sort((a: any, b: any) => b.createdAt - a.createdAt);

  return (
    <>
      <ModalHeader
        title={isEdit ? `Edit ${existing.company}` : 'Track new application'}
        subtitle={isEdit ? 'Update status, notes, or which resume was used.' : 'Log a company you applied to and link the resume version.'}
        onClose={onCancel}
      />
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Company">
            <input className="ff-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Google" autoFocus disabled={submitting} />
          </Field>
          <Field label="Role">
            <input className="ff-input" value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. SWE Intern" disabled={submitting} />
          </Field>
        </div>

        <Field label="Resume version used">
          <select className="ff-select" value={resumeId} onChange={e => setResumeId(e.target.value)} disabled={submitting}>
            <option value="">— none / unlinked —</option>
            {(resumeOptions as any[]).map((r: any) => (
              <option key={r.id} value={r.id}>{r.name} · {shortHash(r.id)}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Status">
            <select className="ff-select" value={status} onChange={e => setStatus(e.target.value)} disabled={submitting}>
              <option value="applied">Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
              <option value="ghosted">Ghosted</option>
            </select>
          </Field>
          <Field label="Date applied">
            <input className="ff-input" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={submitting} />
          </Field>
        </div>

        <Field label="Notes" hint="OA dates, recruiter contacts, follow-up reminders…">
          <textarea
            className="ff-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Recruiter said decision by Friday…"
            style={{ minHeight: 100 }}
            disabled={submitting}
          />
        </Field>
      </div>
      <div style={{ padding: '18px 28px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--paper-2)' }}>
        <button className="ff-btn ff-btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button className="ff-btn" onClick={handleSave} disabled={!company.trim() || submitting}>
          {submitting
            ? <><Loader2 size={13} style={{ animation: 'spin 1.2s linear infinite' }} /> Saving…</>
            : (isEdit ? 'Save changes' : 'Track application')
          }
        </button>
      </div>
    </>
  );
};

const MatchKeywordsModal = ({ resume, onCancel }: any) => {
  const [jd, setJd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    matched: string[];
    missing: string[];
    score: number;
    all_keywords: { term: string; count: number; matched: boolean }[];
  } | null>(null);

  const handleMatch = async () => {
    if (jd.trim().length < 20) {
      setError('Paste at least a paragraph of the job description.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api.resumes.matchKeywords({
        resume_id: resume.id,
        job_text: jd,
      });
      setResult(r);
    } catch (e: any) {
      setError(e?.message || 'Failed to match keywords');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <>
      <ModalHeader
        title={result ? 'Keyword match' : 'Match against a job posting'}
        subtitle={result
          ? `${resume.name} · ${result.all_keywords.length} keywords extracted`
          : `Paste a job description. We'll extract the key skills and tools, then highlight what's missing from "${resume.name}".`}
        onClose={onCancel}
      />
      {!result && (
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Job description">
            <textarea
              className="ff-textarea"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description here…"
              style={{ minHeight: 220 }}
              disabled={busy}
              autoFocus
            />
          </Field>
          {error && (
            <div className="ff-mono" style={{ fontSize: 11.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </div>
      )}
      {result && (
        <div style={{ padding: '24px 28px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '14px 16px',
            border: '1px solid var(--line)',
            borderRadius: 3,
            background: 'var(--paper-3)',
          }}>
            <div className="ff-tabular ff-display" style={{
              fontSize: 38,
              fontWeight: 600,
              color: result.score >= 70 ? 'var(--green)' : result.score >= 40 ? 'var(--amber)' : 'var(--red)',
              lineHeight: 1,
            }}>
              {result.score}%
            </div>
            <div style={{ flex: 1 }}>
              <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Match score</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>{result.matched.length}</span> matched ·{' '}
                <span style={{ color: 'var(--red)', fontWeight: 600 }}>{result.missing.length}</span> missing
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
            <div>
              <div className="ff-mono ff-label" style={{ color: 'var(--green)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Check size={11} /> In your resume ({result.matched.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.matched.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>None of the JD keywords found.</div>
                )}
                {result.matched.map((t) => (
                  <span key={t} className="ff-chip ff-status-offer" style={{ textTransform: 'none' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="ff-mono ff-label" style={{ color: 'var(--red)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <X size={11} /> Missing ({result.missing.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.missing.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>Nothing missing — strong match.</div>
                )}
                {result.missing.map((t) => (
                  <span key={t} className="ff-chip ff-status-rejected" style={{ textTransform: 'none' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: '18px 28px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--paper-2)' }}>
        {result ? (
          <>
            <button className="ff-btn ff-btn-ghost" onClick={reset} disabled={busy}>
              <RefreshCw size={13} /> Try another
            </button>
            <button className="ff-btn" onClick={onCancel}>Done</button>
          </>
        ) : (
          <>
            <button className="ff-btn ff-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
            <button className="ff-btn" onClick={handleMatch} disabled={busy || jd.trim().length < 20}>
              {busy
                ? <><Loader2 size={13} style={{ animation: 'spin 1.2s linear infinite' }} /> Analyzing…</>
                : <><Search size={13} /> Run match</>
              }
            </button>
          </>
        )}
      </div>
    </>
  );
};

const INTERVIEW_KINDS = ['Phone screen', 'Recruiter', 'Technical', 'Behavioral', 'Onsite', 'Final round', 'Take-home', 'OA'];
const INTERVIEW_OUTCOMES: { id: string; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'passed', label: 'Passed' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'withdrew', label: 'Withdrew' },
];

const fmtInterviewWhen = (ts: number | null) => {
  if (!ts) return 'Not scheduled';
  const d = new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    hour: 'numeric', minute: '2-digit',
  });
};

const toDatetimeLocal = (ts: number | null): string => {
  if (!ts) return '';
  const d = new Date(ts - d_tzOffset(ts));
  return d.toISOString().slice(0, 16);
};
const d_tzOffset = (ts: number) => new Date(ts).getTimezoneOffset() * 60000;

const InterviewsModal = ({ application, data, onCancel, onChanged }: any) => {
  const seedInterviews = data.interviewsByApp?.[application.id] ?? [];
  const [items, setItems] = useState<any[]>(seedInterviews);
  const [draft, setDraft] = useState<{ kind: string; scheduledAt: string; notes: string; outcome: string }>({
    kind: 'Phone screen',
    scheduledAt: '',
    notes: '',
    outcome: 'pending',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<any>(null);
  const [showForm, setShowForm] = useState(seedInterviews.length === 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const fresh = await api.interviews.list(application.id);
      setItems(
        fresh.map((iv: any) => ({
          ...iv,
          applicationId: iv.application_id,
          scheduledAt: iv.scheduled_at ? new Date(iv.scheduled_at).getTime() : null,
        }))
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load interviews');
    }
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.interviews.create({
        application_id: application.id,
        kind: draft.kind || null,
        scheduled_at: draft.scheduledAt ? new Date(draft.scheduledAt).toISOString() : null,
        notes: draft.notes,
        outcome: (draft.outcome as any) || null,
      });
      await refresh();
      onChanged?.();
      setDraft({ kind: 'Phone screen', scheduledAt: '', notes: '', outcome: 'pending' });
      setShowForm(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to save interview');
    } finally {
      setBusy(false);
    }
  };

  const beginEdit = (iv: any) => {
    setEditingId(iv.id);
    setEditDraft({
      kind: iv.kind || 'Phone screen',
      scheduledAt: toDatetimeLocal(iv.scheduledAt),
      notes: iv.notes || '',
      outcome: iv.outcome || 'pending',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editDraft) return;
    setBusy(true);
    setError(null);
    try {
      await api.interviews.update(editingId, {
        kind: editDraft.kind || null,
        scheduled_at: editDraft.scheduledAt ? new Date(editDraft.scheduledAt).toISOString() : null,
        notes: editDraft.notes,
        outcome: (editDraft.outcome as any) || null,
      });
      setEditingId(null);
      setEditDraft(null);
      await refresh();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this interview?')) return;
    setBusy(true);
    try {
      await api.interviews.delete(id);
      await refresh();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ModalHeader
        title={`Interviews · ${application.company}`}
        subtitle={`${application.role || 'Role unspecified'} · ${items.length} interview${items.length === 1 ? '' : 's'}`}
        onClose={onCancel}
      />
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div className="ff-mono" style={{ fontSize: 11.5, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={12} /> {error}
          </div>
        )}

        {items.length === 0 && !showForm && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
            <Calendar size={22} style={{ opacity: 0.5 }} />
            <div style={{ marginTop: 10, fontSize: 13 }}>No interviews logged for this application yet.</div>
          </div>
        )}

        {items.map((iv) => {
          const isEditing = editingId === iv.id;
          return (
            <div key={iv.id} style={{
              border: '1px solid var(--line)',
              borderRadius: 3,
              padding: 14,
              background: 'var(--paper-2)',
            }}>
              {!isEditing ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="ff-chip" style={{ textTransform: 'none' }}>{iv.kind || 'Interview'}</span>
                      {iv.outcome && (
                        <span className={`ff-chip ff-status-${iv.outcome === 'passed' ? 'offer' : iv.outcome === 'rejected' ? 'rejected' : iv.outcome === 'withdrew' ? 'ghosted' : 'applied'}`} style={{ textTransform: 'none' }}>
                          {INTERVIEW_OUTCOMES.find((o) => o.id === iv.outcome)?.label || iv.outcome}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => beginEdit(iv)} disabled={busy} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)' }} title="Edit">
                        <Edit3 size={13} />
                      </button>
                      <button onClick={() => handleDelete(iv.id)} disabled={busy} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--ink-3)' }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="ff-mono" style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={11} /> {fmtInterviewWhen(iv.scheduledAt)}
                  </div>
                  {iv.notes && (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {iv.notes}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <select className="ff-select" value={editDraft.kind} onChange={(e) => setEditDraft({ ...editDraft, kind: e.target.value })} disabled={busy}>
                      {INTERVIEW_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <select className="ff-select" value={editDraft.outcome} onChange={(e) => setEditDraft({ ...editDraft, outcome: e.target.value })} disabled={busy}>
                      {INTERVIEW_OUTCOMES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                  <input className="ff-input" type="datetime-local" value={editDraft.scheduledAt} onChange={(e) => setEditDraft({ ...editDraft, scheduledAt: e.target.value })} disabled={busy} />
                  <textarea className="ff-textarea" value={editDraft.notes} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} placeholder="Recruiter, prep notes, follow-ups…" style={{ minHeight: 80 }} disabled={busy} />
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={() => { setEditingId(null); setEditDraft(null); }} disabled={busy}>Cancel</button>
                    <button className="ff-btn ff-btn-sm" onClick={handleSaveEdit} disabled={busy}>
                      {busy ? <><Loader2 size={11} style={{ animation: 'spin 1.2s linear infinite' }} /> Saving…</> : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {showForm ? (
          <div style={{
            border: '1px dashed var(--line-2)',
            borderRadius: 3,
            padding: 16,
            background: 'var(--paper)',
          }}>
            <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 10 }}>
              <Plus size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} /> Add interview
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select className="ff-select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} disabled={busy}>
                {INTERVIEW_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <select className="ff-select" value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })} disabled={busy}>
                {INTERVIEW_OUTCOMES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <input className="ff-input" type="datetime-local" value={draft.scheduledAt} onChange={(e) => setDraft({ ...draft, scheduledAt: e.target.value })} disabled={busy} style={{ marginBottom: 10 }} />
            <textarea
              className="ff-textarea"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Recruiter name, agenda, prep notes…"
              style={{ minHeight: 90 }}
              disabled={busy}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              {items.length > 0 && (
                <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={() => setShowForm(false)} disabled={busy}>Cancel</button>
              )}
              <button className="ff-btn ff-btn-sm" onClick={handleCreate} disabled={busy}>
                {busy ? <><Loader2 size={11} style={{ animation: 'spin 1.2s linear infinite' }} /> Saving…</> : 'Save interview'}
              </button>
            </div>
          </div>
        ) : (
          <button className="ff-btn ff-btn-ghost" onClick={() => setShowForm(true)} disabled={busy} style={{ justifyContent: 'center' }}>
            <Plus size={13} /> Add interview
          </button>
        )}
      </div>
      <div style={{ padding: '18px 28px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--paper-2)' }}>
        <button className="ff-btn" onClick={onCancel} disabled={busy}>Done</button>
      </div>
    </>
  );
};

const ConfirmDialog = ({ title, message, confirmLabel, danger, onConfirm, onCancel, submitting }: any) => (
  <>
    <ModalHeader title={title} onClose={onCancel} />
    <div style={{ padding: '24px 28px' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <AlertCircle size={20} style={{ color: danger ? 'var(--red)' : 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>{message}</div>
      </div>
    </div>
    <div style={{ padding: '18px 28px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--paper-2)' }}>
      <button className="ff-btn ff-btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
      <button className={`ff-btn ${danger ? 'ff-btn-danger' : ''}`} onClick={onConfirm} disabled={submitting}>
        {submitting
          ? <><Loader2 size={13} style={{ animation: 'spin 1.2s linear infinite' }} /> Working…</>
          : confirmLabel
        }
      </button>
    </div>
  </>
);

export default App;
