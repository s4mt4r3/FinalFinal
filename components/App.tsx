'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  GitBranch, FileText, BarChart3, Briefcase, GitCompare,
  Plus, X, Edit3, Trash2, Download, ChevronRight, ChevronDown,
  Calendar, Tag, AlertCircle, Check, Loader2, GitCommit,
  ArrowRight, Search, MoreHorizontal, Copy, ExternalLink,
  Sparkles, TrendingUp, FileCheck, Hash, Clock, Layers,
  RefreshCw, MessageSquare, Filter, LogOut, Upload
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
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

/* ----------------------------- diff engine ----------------------------- */
function diffLines(aText: string, bText: string) {
  const a = (aText || '').split('\n');
  const b = (bText || '').split('\n');
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = dp[i - 1][j] >= dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1];
    }
  }
  const out: { type: string; text: string }[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ type: 'same', text: a[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.push({ type: 'removed', text: a[i - 1] });
      i--;
    } else {
      out.push({ type: 'added', text: b[j - 1] });
      j--;
    }
  }
  while (i > 0) { out.push({ type: 'removed', text: a[i - 1] }); i--; }
  while (j > 0) { out.push({ type: 'added', text: b[j - 1] }); j--; }
  return out.reverse();
}

function diffStats(diff: { type: string; text: string }[]) {
  let added = 0, removed = 0;
  for (const d of diff) {
    if (d.type === 'added') added++;
    else if (d.type === 'removed') removed++;
  }
  return { added, removed };
}

/* ----------------------------- demo seed ----------------------------- */

function makeDemoData() {
  const now = Date.now();
  const days = (n: number) => now - n * 86400000;

  const masterId = uid();
  const seId = uid();
  const seV2 = uid();
  const seGoogle = uid();
  const qfId = uid();
  const qfV2 = uid();

  const master = `SAMIK TARE
samik.tare@rutgers.edu | linkedin.com/in/samik-tare | github.com/s4mt4r3

EDUCATION
Rutgers University, Honors College — New Brunswick, NJ
B.S. Computer Science & Mathematics, GPA 3.56
Expected May 2028

EXPERIENCE
Ingredion — Data Science Extern
Built GPT-4o ingredient classification pipeline.

PROJECTS
CLIP vs ResNet18 Benchmark
Compared zero-shot CLIP against fine-tuned ResNet18 on CIFAR-10.

SKILLS
Python, C, Java, PyTorch, scikit-learn, Git, Linux`;

  const seEng = master + `

ADDITIONAL
Member, ScarletAPIs (Rutgers CS competition team)`;

  const seEngV2 = `SAMIK TARE
samik.tare@rutgers.edu | linkedin.com/in/samik-tare | github.com/s4mt4r3

EDUCATION
Rutgers University, Honors College — New Brunswick, NJ
B.S. Computer Science & Mathematics, GPA 3.56
Expected May 2028

EXPERIENCE
Ingredion — Data Science Extern
Built GPT-4o ingredient classification pipeline processing 12,000 SKUs.
Reduced manual tagging time by 87%.

PROJECTS
CLIP vs ResNet18 Benchmark
Compared zero-shot CLIP (90.6% acc, 50.4ms) against fine-tuned ResNet18 (78.8%, 4.6ms) on CIFAR-10.
Quantified accuracy/latency/memory tradeoffs across deployment targets.

RAISE-26 NLP Hackathon — Top 17 of 188 teams
Built 7-model NLP pipeline analyzing 10,500 AI news articles.

SKILLS
Python, C, Java, PyTorch, scikit-learn, Git, Linux, Valgrind, GDB

ADDITIONAL
Member, ScarletAPIs (Rutgers CS competition team)`;

  const seGoogleV = seEngV2.replace(
    'SKILLS\nPython, C, Java, PyTorch, scikit-learn, Git, Linux, Valgrind, GDB',
    'SKILLS\nPython, C++, Java, Go, PyTorch, TensorFlow, scikit-learn, Git, Linux, gRPC, Bazel'
  ).replace(
    'Built GPT-4o ingredient classification pipeline processing 12,000 SKUs.',
    'Designed and shipped GPT-4o ingredient classification pipeline serving 12,000 SKUs in production.'
  );

  const qf = `SAMIK TARE
samik.tare@rutgers.edu | linkedin.com/in/samik-tare | github.com/s4mt4r3

EDUCATION
Rutgers University, Honors College — New Brunswick, NJ
B.S. Computer Science & Mathematics, GPA 3.56
Coursework: Linear Optimization, Probability, Real Analysis

EXPERIENCE
Ingredion — Data Science Extern
Built GPT-4o ingredient classification pipeline.

PROJECTS
Portfolio Optimizer — Prophet + Markowitz mean-variance
13-ticker equity universe with annualized return forecasts.

SKILLS
Python, C, Java, NumPy, pandas, scikit-learn, Git, Linux`;

  const qfV2T = `SAMIK TARE
samik.tare@rutgers.edu | linkedin.com/in/samik-tare | github.com/s4mt4r3

EDUCATION
Rutgers University, Honors College — New Brunswick, NJ
B.S. Computer Science & Mathematics, GPA 3.56
Coursework: Linear Optimization, Probability, Real Analysis, Stochastic Processes

EXPERIENCE
Ingredion — Data Science Extern
Built GPT-4o ingredient classification pipeline processing 12,000 SKUs.

PROJECTS
Portfolio Optimizer — Prophet + Markowitz mean-variance
13-ticker equity universe with annualized return forecasts, Streamlit deployment, CI/CD via GitHub Actions.
Identified and corrected one-day vs annualized return scaling bug.

Airfoil Surrogate MLP
Two-layer MLP achieving R²=0.997 (CL) and R²=0.996 (CD) on 500-sample thin-airfoil dataset.

SKILLS
Python, C, Java, NumPy, pandas, scikit-learn, Bloomberg Terminal, KDB+/q, Git, Linux`;

  const resumes: Record<string, any> = {
    [masterId]: { id: masterId, name: 'Master Resume', content: master, parentId: null, createdAt: days(45), tags: ['master'], notes: 'Source of truth. All other versions branch from here.' },
    [seId]: { id: seId, name: 'Software Engineering', content: seEng, parentId: masterId, createdAt: days(38), tags: ['swe'], notes: '' },
    [seV2]: { id: seV2, name: 'SWE — Quantified Bullets', content: seEngV2, parentId: seId, createdAt: days(21), tags: ['swe'], notes: 'Added metrics to every bullet after career center feedback.' },
    [seGoogle]: { id: seGoogle, name: 'SWE — Google Tailored', content: seGoogleV, parentId: seV2, createdAt: days(12), tags: ['swe', 'google'], notes: 'Swapped in C++/Go/Bazel for Google application.' },
    [qfId]: { id: qfId, name: 'Quant / Finance', content: qf, parentId: masterId, createdAt: days(34), tags: ['quant'], notes: '' },
    [qfV2]: { id: qfV2, name: 'Quant — Coursework Stack', content: qfV2T, parentId: qfId, createdAt: days(9), tags: ['quant', 'citadel'], notes: 'Front-loaded math coursework and added Bloomberg/KDB keywords.' },
  };

  const apps: Record<string, any> = {};
  const mk = (company: string, role: string, resumeId: string, status: string, daysAgo: number, notes = '') => {
    const id = uid();
    apps[id] = { id, company, role, resumeId, status, dateApplied: days(daysAgo), notes };
  };
  mk('Google', 'SWE Intern', seGoogle, 'interviewing', 8, 'OA passed. Onsite scheduled for next week.');
  mk('Meta', 'SWE Intern', seV2, 'rejected', 15, 'No response after OA.');
  mk('Stripe', 'SWE Intern', seV2, 'applied', 6);
  mk('Citadel', 'Quant Intern', qfV2, 'offer', 4, 'Verbal offer extended after superday.');
  mk('Jane Street', 'Quant Trader Intern', qfV2, 'interviewing', 7);
  mk('Two Sigma', 'Quant Researcher', qfId, 'ghosted', 28);
  mk('Jump Trading', 'SWE Intern', seGoogle, 'applied', 3);

  return { resumes, applications: apps, rootId: masterId, version: 1 };
}

/* ----------------------------- data loading ----------------------------- */

async function loadData() {
  const [resumes, applications] = await Promise.all([
    api.resumes.list(),
    api.applications.list(),
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

  const rootId = resumes.find((r: any) => !r.parent_id)?.id ?? null;

  return {
    resumes: resumesObj,
    applications: applicationsObj,
    rootId,
    version: 1,
  };
}

/* ----------------------------- tree helpers ----------------------------- */

function buildTree(resumes: Record<string, any>) {
  const childrenOf: Record<string, string[]> = {};
  const roots: string[] = [];
  Object.values(resumes).forEach((r: any) => {
    if (r.parentId && resumes[r.parentId]) {
      (childrenOf[r.parentId] ||= []).push(r.id);
    } else {
      roots.push(r.id);
    }
  });
  for (const k of Object.keys(childrenOf)) {
    childrenOf[k].sort((a, b) => resumes[a].createdAt - resumes[b].createdAt);
  }
  roots.sort((a, b) => resumes[a].createdAt - resumes[b].createdAt);
  return { roots, childrenOf };
}

function descendants(resumes: Record<string, any>, id: string, acc = new Set<string>()) {
  acc.add(id);
  for (const r of Object.values(resumes)) {
    if (r.parentId === id) descendants(resumes, r.id, acc);
  }
  return acc;
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
  const [data, setData] = useState<any>({ resumes: {}, applications: {}, rootId: null });
  const [view, setView] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [submitting, setSubmitting] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

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
        setData({ resumes: {}, applications: {}, rootId: null, version: 1 });
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

  const createResume = async ({ name, content, parentId, tags, notes }: any) => {
    setSubmitting(true);
    try {
      const created = await api.resumes.create({
        name: name.trim() || 'Untitled',
        content: content || '',
        parent_id: parentId || null,
        tags: tags || [],
        notes: notes || '',
      });
      await reloadData();
      flash(`Created "${name}"`);
      return created.id;
    } catch (e) {
      handleError(e);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const updateResume = async (id: string, patch: any) => {
    const updatePayload: any = {};
    if (patch.name !== undefined) updatePayload.name = patch.name;
    if (patch.content !== undefined) updatePayload.content = patch.content;
    if (patch.tags !== undefined) updatePayload.tags = patch.tags;
    if (patch.notes !== undefined) updatePayload.notes = patch.notes;

    setSubmitting(true);
    try {
      await api.resumes.update(id, updatePayload);
      await reloadData();
    } catch (e) {
      handleError(e);
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const deleteResume = async (id: string) => {
    const toDelete = descendants(data.resumes, id);
    const count = toDelete.size;

    setSubmitting(true);
    try {
      for (const rid of toDelete) {
        await api.resumes.delete(rid);
      }
      await reloadData();
      flash(`Deleted ${count} version${count === 1 ? '' : 's'}`);
    } catch (e) {
      handleError(e);
    } finally {
      setSubmitting(false);
    }
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
        date_applied: app.dateApplied || new Date().toISOString(),
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

  const resetDemo = async () => {
    const demo = makeDemoData();

    setSubmitting(true);
    try {
      // Resumes form a tree: insert parents before children so each child's
      // parent_id can be remapped from the demo's local UUID to the freshly
      // generated DB UUID. Without this remap, the parent_id RLS check fails
      // because the local UUID doesn't exist in the resumes table.
      const localToDbId: Record<string, string> = {};
      const remaining = new Map<string, any>(Object.entries(demo.resumes));
      while (remaining.size > 0) {
        let progressed = false;
        for (const [localId, resume] of Array.from(remaining)) {
          const parentReady =
            !resume.parentId || localToDbId[resume.parentId];
          if (!parentReady) continue;
          const created = await api.resumes.create({
            name: resume.name,
            content: resume.content,
            parent_id: resume.parentId ? localToDbId[resume.parentId] : null,
            tags: resume.tags || [],
            notes: resume.notes || '',
          });
          localToDbId[localId] = created.id;
          remaining.delete(localId);
          progressed = true;
        }
        if (!progressed) {
          throw new Error('Demo data has a cyclic or dangling parent reference');
        }
      }

      // Now insert applications, remapping each app's resume_id to the DB id.
      for (const app of Object.values(demo.applications) as any[]) {
        await api.applications.create({
          company: app.company,
          role: app.role,
          status: app.status,
          notes: app.notes || '',
          resume_id: app.resumeId ? localToDbId[app.resumeId] ?? null : null,
          date_applied: new Date(app.dateApplied).toISOString(),
        });
      }

      await reloadData();
      setCompareA(null);
      setCompareB(null);
      flash('Reset to demo data');
    } catch (e) {
      handleError(e);
    } finally {
      setSubmitting(false);
    }
  };

  const wipe = async () => {
    const allResumes = Object.keys(data.resumes);
    const allApps = Object.keys(data.applications);

    setSubmitting(true);
    try {
      for (const appId of allApps) {
        await api.applications.delete(appId);
      }
      for (const resumeId of allResumes) {
        await api.resumes.delete(resumeId);
      }

      await reloadData();
      setCompareA(null);
      setCompareB(null);
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
              v1.0 · resume vcs
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <NavItem icon={<BarChart3 size={15} />} label="Dashboard" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
            <NavItem icon={<GitBranch size={15} />} label="Versions" active={view === 'versions'} onClick={() => setView('versions')} />
            <NavItem icon={<GitCompare size={15} />} label="Compare" active={view === 'compare'} onClick={() => setView('compare')} />
            <NavItem icon={<Briefcase size={15} />} label="Applications" active={view === 'applications'} onClick={() => setView('applications')} />
            <NavItem icon={<TrendingUp size={15} />} label="Analytics" active={view === 'analytics'} onClick={() => setView('analytics')} />
          </nav>

          <div style={{ marginTop: 36 }}>
            <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 12, paddingLeft: 14 }}>
              At a glance
            </div>
            <Glance data={data} />
          </div>

          <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <button className="ff-btn ff-btn-ghost ff-btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }} onClick={resetDemo} disabled={submitting}>
              <RefreshCw size={11} /> Reload demo
            </button>
            <button className="ff-btn ff-btn-ghost ff-btn-sm" style={{ width: '100%', justifyContent: 'center', color: 'var(--red)', marginBottom: 8 }} onClick={() => setModal({ type: 'confirmWipe' })} disabled={submitting}>
              Wipe all data
            </button>
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
              setCompareA={setCompareA}
              setCompareB={setCompareB}
              submitting={submitting}
            />
          )}
          {view === 'versions' && (
            <Versions
              data={data}
              openModal={setModal}
              setCompareA={setCompareA}
              setCompareB={setCompareB}
              setView={setView}
              deleteResume={deleteResume}
              submitting={submitting}
            />
          )}
          {view === 'compare' && (
            <Compare
              data={data}
              compareA={compareA}
              compareB={compareB}
              setCompareA={setCompareA}
              setCompareB={setCompareB}
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
          createResume={createResume}
          updateResume={updateResume}
          deleteResume={deleteResume}
          createApplication={createApplication}
          updateApplication={updateApplication}
          wipe={wipe}
          submitting={submitting}
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
  const versionCount = Object.keys(data.resumes).length;
  const appCount = Object.keys(data.applications).length;
  const interviews = Object.values(data.applications).filter((a: any) => a.status === 'interviewing' || a.status === 'offer').length;
  return (
    <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Stat n={versionCount} label="versions" />
      <Stat n={appCount} label="applications" />
      <Stat n={interviews} label="active leads" accent />
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

const Dashboard = ({ data, setView, openModal, setCompareA, setCompareB, submitting }: any) => {
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
        subtitle="Your resume history, applications, and what's working — in one place."
        action={
          <button className="ff-btn" onClick={() => openModal({ type: 'newResume', payload: { parentId: null } })} disabled={submitting}>
            <Plus size={13} /> New resume
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 36 }}>
        <BigStat label="Versions tracked" value={Object.keys(data.resumes).length} sub="across all branches" />
        <BigStat label="Applications" value={Object.keys(data.applications).length} sub="this cycle" />
        <BigStat label="Active leads" value={(apps as any[]).filter((a: any) => a.status === 'interviewing').length} sub="interviewing" accent />
        <BigStat label="Offers" value={(apps as any[]).filter((a: any) => a.status === 'offer').length} sub="received" />
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
              <span className="ff-italic">"{best.name}"</span> is your highest-performing version.
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
              onClick={() => { setView('versions'); }}
            >
              View version <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, marginTop: 32 }}>
        <div>
          <SectionHeader title="Recent versions" onAction={() => setView('versions')} actionLabel="All versions" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {recent.length === 0 && <EmptyHint text="No versions yet. Create your master resume to start." />}
            {(recent as any[]).map((r: any) => (
              <div key={r.id} className="ff-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <GitCommit size={15} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{r.name}</div>
                    <div className="ff-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                      {shortHash(r.id)}
                    </div>
                  </div>
                  <div className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {r.parentId ? `branched from ${data.resumes[r.parentId]?.name || '—'}` : 'root'} · {fmtDate(r.createdAt)}
                  </div>
                </div>
                {r.tags && r.tags.map((t: string) => <span key={t} className="ff-chip">{t}</span>)}
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
                <div key={a.id} className="ff-card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StatusDot status={a.status} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{a.company}</div>
                      <div className="ff-mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
                        {a.role} · {fmtDate(a.dateApplied)}
                      </div>
                    </div>
                    <StatusChip status={a.status} />
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
   VERSIONS — tree view
   =================================================================== */

const Versions = ({ data, openModal, setCompareA, setCompareB, setView, deleteResume, submitting }: any) => {
  const { roots, childrenOf } = useMemo(() => buildTree(data.resumes), [data.resumes]);
  const [expanded, setExpanded] = useState(() => new Set(Object.keys(data.resumes)));
  const [selectedId, setSelectedId] = useState<string | null>(roots[0] || null);

  useEffect(() => {
    setExpanded(new Set(Object.keys(data.resumes)));
  }, [data.resumes]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selected = selectedId && data.resumes[selectedId];
  const appsForSelected = selected ? Object.values(data.applications).filter((a: any) => a.resumeId === selected.id) : [];

  return (
    <div className="ff-fade">
      <Header
        kicker="Version history"
        title="Your resume tree."
        subtitle="Every branch, every commit. Click a version to inspect, edit, or branch from it."
        action={
          <button className="ff-btn" onClick={() => openModal({ type: 'newResume', payload: { parentId: null } })} disabled={submitting}>
            <Plus size={13} /> New root
          </button>
        }
      />

      {roots.length === 0 ? (
        <div style={{ marginTop: 60, textAlign: 'center', padding: 40 }}>
          <FileText size={32} style={{ color: 'var(--ink-3)' }} />
          <div className="ff-display" style={{ fontSize: 22, marginTop: 16, fontWeight: 500 }}>No versions yet</div>
          <div style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: 14 }}>Create your master resume to get started.</div>
          <button className="ff-btn" style={{ marginTop: 20 }} onClick={() => openModal({ type: 'newResume', payload: { parentId: null } })} disabled={submitting}>
            <Plus size={13} /> Create master resume
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 36 }}>
          <div>
            <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 16 }}>Tree</div>
            <div className="ff-card" style={{ padding: '18px 14px' }}>
              {roots.map(id => (
                <TreeNode
                  key={id}
                  id={id}
                  data={data}
                  childrenOf={childrenOf}
                  depth={0}
                  expanded={expanded}
                  toggle={toggle}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  isLastChild
                />
              ))}
            </div>
          </div>

          <div>
            <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 16 }}>Inspect</div>
            {!selected ? (
              <div className="ff-card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
                Select a version from the tree
              </div>
            ) : (
              <VersionDetail
                resume={selected}
                parent={selected.parentId ? data.resumes[selected.parentId] : null}
                apps={appsForSelected}
                allResumes={data.resumes}
                openModal={openModal}
                submitting={submitting}
                onCompare={(against: string) => {
                  setCompareA(against);
                  setCompareB(selected.id);
                  setView('compare');
                }}
                onDelete={() => {
                  if (confirm(`Delete "${selected.name}" and all branches under it?`)) {
                    deleteResume(selected.id);
                    setSelectedId(null);
                  }
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const TreeNode = ({ id, data, childrenOf, depth, expanded, toggle, selectedId, onSelect, isLastChild }: any) => {
  const r = data.resumes[id];
  if (!r) return null;
  const kids = childrenOf[id] || [];
  const isOpen = expanded.has(id);
  const isSelected = selectedId === id;

  return (
    <div>
      <div
        onClick={() => onSelect(id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          marginLeft: depth * 24,
          borderRadius: 3,
          cursor: 'pointer',
          background: isSelected ? 'var(--ink)' : 'transparent',
          color: isSelected ? 'var(--paper)' : 'var(--ink)',
          border: '1px solid ' + (isSelected ? 'var(--ink)' : 'transparent'),
          transition: 'background 120ms, color 120ms',
          position: 'relative',
        }}
        onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--paper-3)'; }}
        onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
      >
        {depth > 0 && (
          <div style={{
            position: 'absolute',
            left: -24 * depth + 18,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
          }}>
            <div style={{ width: 12, height: 1, background: 'var(--line-2)' }} />
          </div>
        )}

        {kids.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggle(id); }}
            style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center' }}
          >
            {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span style={{ width: 13, display: 'inline-block' }}>
            <GitCommit size={11} style={{ opacity: 0.6 }} />
          </span>
        )}

        <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {r.name}
        </span>

        <span className="ff-mono" style={{ fontSize: 10, opacity: isSelected ? 0.7 : 0.5 }}>
          {shortHash(id)}
        </span>
      </div>

      {isOpen && kids.map((kid: string, idx: number) => (
        <TreeNode
          key={kid}
          id={kid}
          data={data}
          childrenOf={childrenOf}
          depth={depth + 1}
          expanded={expanded}
          toggle={toggle}
          selectedId={selectedId}
          onSelect={onSelect}
          isLastChild={idx === kids.length - 1}
        />
      ))}
    </div>
  );
};

const VersionDetail = ({ resume, parent, apps, allResumes, openModal, onCompare, onDelete, submitting }: any) => {
  const [showFull, setShowFull] = useState(false);
  const lineCount = resume.content.split('\n').length;
  const wordCount = resume.content.split(/\s+/).filter(Boolean).length;

  const exportTxt = () => {
    const blob = new Blob([resume.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(resume.name)}_${new Date(resume.createdAt).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ff-card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>
            commit {shortHash(resume.id)} · {fmtDateLong(resume.createdAt)}
          </div>
          <div className="ff-display" style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {resume.name}
          </div>
          {parent ? (
            <div className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
              <GitBranch size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
              branched from <span style={{ color: 'var(--ink)' }}>{parent.name}</span>
            </div>
          ) : (
            <div className="ff-mono" style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6 }}>
              <Layers size={11} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
              root version
            </div>
          )}
        </div>
      </div>

      {resume.tags && resume.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {resume.tags.map((t: string) => <span key={t} className="ff-chip"><Tag size={9} />{t}</span>)}
        </div>
      )}

      {resume.notes && (
        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--paper-3)', borderLeft: '2px solid var(--accent)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 6 }}>
            <MessageSquare size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 5 }} />
            note
          </div>
          {resume.notes}
        </div>
      )}

      <div className="ff-mono" style={{ display: 'flex', gap: 18, marginTop: 16, fontSize: 11, color: 'var(--ink-3)' }}>
        <span><Hash size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />{lineCount} lines</span>
        <span>{wordCount} words</span>
        <span><Briefcase size={10} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />{apps.length} apps</span>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 8 }}>Content</div>
        <pre className="ff-mono ff-scroll" style={{
          background: 'var(--paper-3)', padding: 14, borderRadius: 3,
          fontSize: 11.5, lineHeight: 1.55, color: 'var(--ink)',
          maxHeight: showFull ? 'none' : 200, overflowY: 'auto',
          margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          border: '1px solid var(--line)'
        }}>
          {resume.content || '(empty)'}
        </pre>
        {resume.content.split('\n').length > 8 && (
          <button className="ff-link ff-mono" style={{ background: 'none', border: 'none', fontSize: 11, marginTop: 8 }} onClick={() => setShowFull((s: boolean) => !s)}>
            {showFull ? 'Collapse' : 'Show full'}
          </button>
        )}
      </div>

      {apps.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)', marginBottom: 8 }}>Used for ({apps.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(apps as any[]).map((a: any) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                <StatusDot status={a.status} />
                <span style={{ fontWeight: 500 }}>{a.company}</span>
                <span style={{ color: 'var(--ink-3)' }}>· {a.role}</span>
                <span className="ff-mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginLeft: 'auto' }}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
        <button className="ff-btn ff-btn-sm" onClick={() => openModal({ type: 'newResume', payload: { parentId: resume.id, prefill: resume.content } })} disabled={submitting}>
          <GitBranch size={11} /> Branch
        </button>
        <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={() => openModal({ type: 'editResume', payload: resume })} disabled={submitting}>
          <Edit3 size={11} /> Edit
        </button>
        {parent && (
          <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={() => onCompare(parent.id)} disabled={submitting}>
            <GitCompare size={11} /> Diff with parent
          </button>
        )}
        <button className="ff-btn ff-btn-ghost ff-btn-sm" onClick={exportTxt} disabled={submitting}>
          <Download size={11} /> Export
        </button>
        <button className="ff-btn ff-btn-danger ff-btn-sm" onClick={onDelete} style={{ marginLeft: 'auto' }} disabled={submitting}>
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  );
};

/* ===================================================================
   COMPARE
   =================================================================== */

const Compare = ({ data, compareA, compareB, setCompareA, setCompareB }: any) => {
  const resumes = Object.values(data.resumes).sort((a: any, b: any) => b.createdAt - a.createdAt);

  useEffect(() => {
    if (!compareA && resumes.length >= 2) setCompareA((resumes[1] as any).id);
    if (!compareB && resumes.length >= 1) setCompareB((resumes[0] as any).id);
  }, []); // eslint-disable-line

  const a = compareA && data.resumes[compareA];
  const b = compareB && data.resumes[compareB];
  const diff = useMemo(() => (a && b) ? diffLines(a.content, b.content) : [], [a, b]);
  const stats = useMemo(() => diffStats(diff), [diff]);

  const swap = () => {
    setCompareA(compareB);
    setCompareB(compareA);
  };

  return (
    <div className="ff-fade">
      <Header
        kicker="Compare"
        title="Spot the changes."
        subtitle="Side-by-side line diff. Green is added in the right version, red is removed from the left."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'end', marginTop: 32 }}>
        <div>
          <div className="ff-mono ff-label" style={{ marginBottom: 8, color: 'var(--ink-3)' }}>From (base)</div>
          <select className="ff-select" value={compareA || ''} onChange={e => setCompareA(e.target.value)}>
            <option value="">— select —</option>
            {(resumes as any[]).map((r: any) => (
              <option key={r.id} value={r.id}>{r.name} · {shortHash(r.id)}</option>
            ))}
          </select>
        </div>
        <button className="ff-btn ff-btn-ghost" style={{ marginBottom: 1 }} onClick={swap} disabled={!a || !b}>
          <RefreshCw size={12} /> Swap
        </button>
        <div>
          <div className="ff-mono ff-label" style={{ marginBottom: 8, color: 'var(--ink-3)' }}>To (head)</div>
          <select className="ff-select" value={compareB || ''} onChange={e => setCompareB(e.target.value)}>
            <option value="">— select —</option>
            {(resumes as any[]).map((r: any) => (
              <option key={r.id} value={r.id}>{r.name} · {shortHash(r.id)}</option>
            ))}
          </select>
        </div>
      </div>

      {a && b && (
        <>
          <div className="ff-card" style={{ padding: '16px 22px', marginTop: 24, display: 'flex', alignItems: 'center', gap: 32 }}>
            <div>
              <div className="ff-mono ff-label" style={{ color: 'var(--ink-3)' }}>Diff summary</div>
              <div style={{ marginTop: 4, fontSize: 14 }}>
                <span className="ff-mono ff-tabular" style={{ color: 'var(--green)', fontWeight: 600 }}>+{stats.added}</span>
                {' '}<span style={{ color: 'var(--ink-3)' }}>added</span>
                {' · '}
                <span className="ff-mono ff-tabular" style={{ color: 'var(--red)', fontWeight: 600 }}>−{stats.removed}</span>
                {' '}<span style={{ color: 'var(--ink-3)' }}>removed</span>
              </div>
            </div>
            <div style={{ flex: 1, height: 6, background: 'var(--paper-3)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              {stats.added + stats.removed > 0 && (
                <>
                  <div style={{ background: 'var(--green)', height: '100%', width: `${(stats.added / (stats.added + stats.removed)) * 100}%` }} />
                  <div style={{ background: 'var(--red)', height: '100%', width: `${(stats.removed / (stats.added + stats.removed)) * 100}%` }} />
                </>
              )}
            </div>
          </div>

          <div className="ff-card" style={{ marginTop: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--line)' }}>
              <div style={{ padding: '12px 16px', borderRight: '1px solid var(--line)', background: 'var(--paper-3)' }}>
                <div className="ff-mono ff-label" style={{ color: 'var(--red)' }}>− base</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{a.name}</div>
                <div className="ff-mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{shortHash(a.id)} · {fmtDate(a.createdAt)}</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--paper-3)' }}>
                <div className="ff-mono ff-label" style={{ color: 'var(--green)' }}>+ head</div>
                <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{b.name}</div>
                <div className="ff-mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{shortHash(b.id)} · {fmtDate(b.createdAt)}</div>
              </div>
            </div>

            <div className="ff-mono ff-scroll" style={{ background: 'var(--paper)', maxHeight: 600, overflowY: 'auto', fontSize: 12, lineHeight: 1.6 }}>
              {diff.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-3)' }}>
                  Select two versions to compare
                </div>
              )}
              {diff.map((line, i) => (
                <div
                  key={i}
                  className={`ff-diff-line ${line.type === 'same' ? 'ff-diff-same' : line.type === 'added' ? 'ff-diff-added' : 'ff-diff-removed'}`}
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {line.text || ' '}
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
          gridTemplateColumns: '24px 1.4fr 1.6fr 1.4fr 120px 100px 60px',
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
                gridTemplateColumns: '24px 1.4fr 1.6fr 1.4fr 120px 100px 60px',
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
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
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

const ModalRouter = ({ modal, close, data, createResume, updateResume, deleteResume, createApplication, updateApplication, wipe, submitting }: any) => {
  const safeClose = () => { if (!submitting) close(); };
  return (
    <div className="ff-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) safeClose(); }}>
      <div className={`ff-modal ${modal.type === 'newResume' || modal.type === 'editResume' ? 'ff-modal-wide' : ''}`}>
        {modal.type === 'newResume' && (
          <ResumeForm
            data={data}
            initialParent={modal.payload?.parentId}
            initialContent={modal.payload?.prefill || ''}
            onSave={async (v: any) => { try { await createResume(v); close(); } catch {} }}
            onCancel={safeClose}
            isBranch={!!modal.payload?.parentId}
            submitting={submitting}
          />
        )}
        {modal.type === 'editResume' && (
          <ResumeForm
            data={data}
            existing={modal.payload}
            onSave={async (v: any) => { try { await updateResume(modal.payload.id, v); close(); } catch {} }}
            onCancel={safeClose}
            isEdit
            submitting={submitting}
          />
        )}
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
        {modal.type === 'confirmWipe' && (
          <ConfirmDialog
            title="Wipe all data?"
            message="This will permanently delete all your resume versions and tracked applications. This cannot be undone."
            confirmLabel="Yes, wipe everything"
            danger
            onConfirm={async () => { await wipe(); close(); }}
            onCancel={safeClose}
            submitting={submitting}
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

const ResumeForm = ({ data, existing, initialParent, initialContent, isEdit, isBranch, onSave, onCancel, submitting }: any) => {
  const [name, setName] = useState(existing?.name || (isBranch ? 'New branch' : ''));
  const [content, setContent] = useState(existing?.content ?? initialContent ?? '');
  const [parentId, setParentId] = useState(existing?.parentId ?? initialParent ?? null);
  const [tagsStr, setTagsStr] = useState((existing?.tags || []).join(', '));
  const [notes, setNotes] = useState(existing?.notes || '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allParents = Object.values(data.resumes).filter((r: any) => !existing || (r.id !== existing.id && !descendants(data.resumes, existing.id).has(r.id)));

  const handleSave = () => {
    const tags = tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
    onSave({ name, content, parentId: parentId || null, tags, notes });
  };

  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/resumes/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setContent(json.text);
      if (!name.trim()) {
        setName(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch (e: any) {
      setUploadError(e.message || 'Failed to parse file');
    } finally {
      setUploading(false);
    }
  };

  const onDropZoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const title = isEdit ? `Edit "${existing.name}"` : isBranch ? 'Branch new version' : 'New resume';
  const subtitle = isEdit
    ? 'Update name, content, or metadata.'
    : isBranch
      ? 'This will create a child version. The parent stays untouched.'
      : 'Create a new resume — typically your master, the root of your version tree.';

  return (
    <>
      <ModalHeader title={title} subtitle={subtitle} onClose={onCancel} />
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label="Name">
          <input className="ff-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SWE — Quant tailored" autoFocus disabled={submitting} />
        </Field>

        <Field label="Branched from" hint="Leave as 'no parent' to make this a root version.">
          <select className="ff-select" value={parentId || ''} onChange={e => setParentId(e.target.value || null)} disabled={submitting}>
            <option value="">— no parent (root) —</option>
            {(allParents as any[]).map((r: any) => (
              <option key={r.id} value={r.id}>{r.name} · {shortHash(r.id)}</option>
            ))}
          </select>
        </Field>

        <Field label="Resume content" hint="Paste your resume as plain text, or upload a PDF, DOCX, or TEX file below.">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !uploading && !submitting && fileInputRef.current?.click()}
            style={{
              border: `1px dashed ${dragOver ? 'var(--accent)' : 'var(--line-2)'}`,
              borderRadius: 3,
              padding: '14px 16px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: (uploading || submitting) ? 'not-allowed' : 'pointer',
              background: dragOver ? 'var(--accent-soft)' : 'var(--paper-2)',
              transition: 'background 120ms, border-color 120ms',
              opacity: (uploading || submitting) ? 0.7 : 1,
            }}
          >
            {uploading
              ? <Loader2 size={15} style={{ animation: 'spin 1.2s linear infinite', flexShrink: 0, color: 'var(--ink-3)' }} />
              : <Upload size={15} style={{ flexShrink: 0, color: 'var(--ink-3)' }} />
            }
            <span className="ff-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {uploading ? 'Parsing file…' : 'Drop a PDF, DOCX, or TEX file here, or click to browse'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.tex"
              style={{ display: 'none' }}
              onChange={onDropZoneChange}
            />
          </div>
          {uploadError && (
            <div className="ff-mono" style={{ fontSize: 11, color: 'var(--red)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={12} /> {uploadError}
            </div>
          )}
          <textarea
            className="ff-textarea"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="NAME&#10;email | linkedin | github&#10;&#10;EDUCATION&#10;...&#10;&#10;EXPERIENCE&#10;..."
            disabled={submitting}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Tags" hint="Comma-separated. e.g. swe, google, draft">
            <input className="ff-input" value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="swe, finance, draft" disabled={submitting} />
          </Field>
          <Field label="Notes" hint="Recruiter feedback, what you changed, etc.">
            <input className="ff-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What changed in this version?" disabled={submitting} />
          </Field>
        </div>
      </div>
      <div style={{ padding: '18px 28px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'var(--paper-2)' }}>
        <button className="ff-btn ff-btn-ghost" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button className="ff-btn" onClick={handleSave} disabled={!name.trim() || submitting}>
          {submitting
            ? <><Loader2 size={13} style={{ animation: 'spin 1.2s linear infinite' }} /> Saving…</>
            : (isEdit ? 'Save changes' : isBranch ? 'Create branch' : 'Create resume')
          }
        </button>
      </div>
    </>
  );
};

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
