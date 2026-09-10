// ============================================================
// lib/demo-store.ts
// ============================================================
// A fully in-memory stand-in for the real /api/* routes, used
// when the app runs in "try it without signing in" demo mode
// (see lib/api.ts + app/demo/page.tsx). It mirrors the exact
// shapes lib/api.ts's real callers expect, seeded with sample
// data, so every screen works identically — nothing is ever
// written to Supabase and nothing survives a page reload
// (the store lives only in this module's memory).
// ============================================================

import type {
  Resume,
  Application,
  ApplicationStatus,
  VersionStat,
  ResumeInsert,
  ResumeUpdate,
  ApplicationInsert,
  ApplicationUpdate,
  SectionVariant,
  SectionVariantInsert,
  SectionVariantUpdate,
  SectionKind,
  ComposedResume,
  Interview,
  InterviewInsert,
  InterviewUpdate,
} from '@/types/database';
import { compositionFromVariants } from './compose';
import { renderHtml, renderLatex, renderText } from './resume-render';
import { matchKeywords as runMatchKeywords } from './keyword-matcher';

const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

interface ResumeSectionRow {
  id: string;
  resume_id: string;
  variant_id: string;
  position: number;
}

interface Store {
  resumes: Resume[];
  variants: SectionVariant[];
  resumeSections: ResumeSectionRow[];
  applications: Application[];
  interviews: Interview[];
}

let store: Store = buildSeed();

// Reset to a fresh seed (used when demo mode is (re)entered).
export function resetDemoStore() {
  store = buildSeed();
}

function buildSeed(): Store {
  const now = Date.now();
  const iso = (offsetDays: number) => new Date(now - offsetDays * 86400000).toISOString();

  const headerV: SectionVariant = {
    id: genId(),
    user_id: 'demo',
    kind: 'header',
    label: 'Standard header',
    data: {
      name: 'Jamie Rivera',
      location: 'Austin, TX',
      phone: '(512) 555-0148',
      email: 'jamie.rivera@example.com',
      linkedin: 'linkedin.com/in/jamierivera',
      github: 'github.com/jrivera',
    },
    created_at: iso(30),
    updated_at: iso(30),
  };

  const educationV: SectionVariant = {
    id: genId(),
    user_id: 'demo',
    kind: 'education',
    label: 'UT Austin',
    data: {
      items: [
        {
          school: 'University of Texas at Austin',
          degree: 'Bachelor of Science in Computer Science',
          dateRange: 'Aug. 2021 -- May 2025',
          location: 'Austin, TX',
        },
      ],
    },
    created_at: iso(30),
    updated_at: iso(30),
  };

  const courseworkV: SectionVariant = {
    id: genId(),
    user_id: 'demo',
    kind: 'coursework',
    label: 'CS core',
    data: {
      courses: [
        'Data Structures',
        'Algorithms',
        'Operating Systems',
        'Databases',
        'Distributed Systems',
        'Machine Learning',
      ],
    },
    created_at: iso(30),
    updated_at: iso(30),
  };

  const experienceFull: SectionVariant = {
    id: genId(),
    user_id: 'demo',
    kind: 'experience',
    label: 'Full experience',
    data: {
      items: [
        {
          company: 'Northlake Analytics',
          title: 'Software Engineering Intern',
          dateRange: 'May 2024 -- Aug. 2024',
          location: 'Remote',
          bullets: [
            'Built a React + TypeScript dashboard used by 40+ internal analysts to monitor pipeline health',
            'Cut p95 API latency 35% by adding Redis caching in front of a Postgres reporting query',
            'Wrote integration tests raising backend coverage from 52% to 81%',
          ],
        },
        {
          company: 'UT Austin, Dept. of Computer Science',
          title: 'Undergraduate Teaching Assistant',
          dateRange: 'Jan. 2023 -- May 2024',
          location: 'Austin, TX',
          bullets: [
            'Led weekly discussion sections for 120-student data structures course',
            'Held office hours and graded weekly problem sets for two semesters',
          ],
        },
      ],
    },
    created_at: iso(25),
    updated_at: iso(25),
  };

  const experienceLean: SectionVariant = {
    id: genId(),
    user_id: 'demo',
    kind: 'experience',
    label: 'Lean (internship only)',
    data: {
      items: [experienceFull.data.items[0]],
    },
    created_at: iso(20),
    updated_at: iso(20),
  };

  const projectsV: SectionVariant = {
    id: genId(),
    user_id: 'demo',
    kind: 'projects',
    label: 'Core projects',
    data: {
      items: [
        {
          name: 'FinalFinal',
          tech: 'Next.js, TypeScript, Supabase, Postgres',
          date: 'Mar. 2026',
          bullets: [
            'Built a section-based resume composer with one-page auto-fit preview and LaTeX export',
          ],
        },
        {
          name: 'Pathfinder',
          tech: 'Python, Flask, PostgreSQL',
          date: 'Nov. 2025',
          bullets: [
            'Wrote a route-optimization service using Dijkstra over live traffic data for a class capstone',
          ],
        },
      ],
    },
    created_at: iso(18),
    updated_at: iso(18),
  };

  const skillsV: SectionVariant = {
    id: genId(),
    user_id: 'demo',
    kind: 'skills',
    label: 'General skills',
    data: {
      categories: [
        { category: 'Languages', items: 'Python, TypeScript, Java, SQL, C++' },
        { category: 'Frameworks', items: 'React, Next.js, Node.js, Flask' },
        { category: 'Tools', items: 'Git, Docker, AWS, Postgres, Redis' },
      ],
    },
    created_at: iso(15),
    updated_at: iso(15),
  };

  const leadershipV: SectionVariant = {
    id: genId(),
    user_id: 'demo',
    kind: 'leadership',
    label: 'Clubs',
    data: {
      items: [
        {
          organization: 'HackUT',
          role: 'Logistics Lead',
          dateRange: 'Sep. 2023 -- May 2025',
          location: 'Austin, TX',
          bullets: ['Coordinated venue, sponsors, and 500+ attendee check-in for annual hackathon'],
        },
      ],
    },
    created_at: iso(15),
    updated_at: iso(15),
  };

  const variants = [
    headerV,
    educationV,
    courseworkV,
    experienceFull,
    experienceLean,
    projectsV,
    skillsV,
    leadershipV,
  ];

  const swResumeId = genId();
  const dataResumeId = genId();

  const swComposition = [headerV, educationV, experienceFull, projectsV, skillsV, leadershipV];
  const dataComposition = [headerV, educationV, courseworkV, experienceLean, projectsV, skillsV];

  const resumeSections: ResumeSectionRow[] = [
    ...swComposition.map((v, i) => ({ id: genId(), resume_id: swResumeId, variant_id: v.id, position: i })),
    ...dataComposition.map((v, i) => ({ id: genId(), resume_id: dataResumeId, variant_id: v.id, position: i })),
  ];

  const resumes: Resume[] = [
    {
      id: swResumeId,
      user_id: 'demo',
      parent_id: null,
      name: 'Software Engineer — New Grad',
      content: renderText(compositionFromVariants(swComposition)),
      tags: ['swe', 'new-grad'],
      notes: 'General SWE new-grad resume, full experience section.',
      source_file_path: null,
      created_at: iso(14),
      updated_at: iso(3),
    },
    {
      id: dataResumeId,
      user_id: 'demo',
      parent_id: null,
      name: 'Data / ML Roles',
      content: renderText(compositionFromVariants(dataComposition)),
      tags: ['data', 'ml'],
      notes: 'Leaner experience section, adds coursework for data roles.',
      source_file_path: null,
      created_at: iso(10),
      updated_at: iso(1),
    },
  ];

  const mkApp = (
    company: string,
    role: string,
    resume_id: string,
    status: ApplicationStatus,
    daysAgo: number,
    notes = ''
  ): Application => ({
    id: genId(),
    user_id: 'demo',
    resume_id,
    company,
    role,
    status,
    notes,
    date_applied: iso(daysAgo),
    created_at: iso(daysAgo),
    updated_at: iso(Math.max(0, daysAgo - 1)),
  });

  const applications: Application[] = [
    mkApp('Meridian Systems', 'Software Engineer', swResumeId, 'offer', 21, 'Onsite went great'),
    mkApp('Cobalt Data', 'ML Engineer', dataResumeId, 'interviewing', 12),
    mkApp('Riverstone Labs', 'Backend Engineer', swResumeId, 'applied', 6),
    mkApp('Fenwick & Co.', 'Data Scientist', dataResumeId, 'rejected', 25, 'Went with someone with a PhD'),
    mkApp('Alderton Tech', 'Software Engineer', swResumeId, 'ghosted', 40),
  ];

  const interviews: Interview[] = [
    {
      id: genId(),
      user_id: 'demo',
      application_id: applications[0].id,
      scheduled_at: iso(14),
      kind: 'Phone screen',
      notes: 'Recruiter call, discussed background and comp expectations.',
      outcome: 'passed',
      created_at: iso(14),
      updated_at: iso(14),
    },
    {
      id: genId(),
      user_id: 'demo',
      application_id: applications[0].id,
      scheduled_at: iso(7),
      kind: 'Onsite',
      notes: 'Four rounds: two coding, one system design, one behavioral.',
      outcome: 'passed',
      created_at: iso(7),
      updated_at: iso(7),
    },
    {
      id: genId(),
      user_id: 'demo',
      application_id: applications[1].id,
      scheduled_at: iso(9),
      kind: 'Technical screen',
      notes: 'Take-home ML case study, discussed results live.',
      outcome: null,
      created_at: iso(9),
      updated_at: iso(9),
    },
  ];

  return { resumes, variants, resumeSections, applications, interviews };
}

function notFound(): never {
  throw new Error('Not found');
}

function hydrateComposition(resumeId: string): SectionVariant[] {
  const rows = store.resumeSections
    .filter((rs) => rs.resume_id === resumeId)
    .sort((a, b) => a.position - b.position);
  const byId = new Map(store.variants.map((v) => [v.id, v]));
  return rows.map((r) => byId.get(r.variant_id)).filter(Boolean) as SectionVariant[];
}

function setResumeComposition(resumeId: string, variantIds: string[]) {
  store.resumeSections = store.resumeSections.filter((rs) => rs.resume_id !== resumeId);
  variantIds.forEach((variant_id, position) => {
    store.resumeSections.push({ id: genId(), resume_id: resumeId, variant_id, position });
  });
  const variants = hydrateComposition(resumeId);
  const resume = store.resumes.find((r) => r.id === resumeId);
  if (resume) {
    resume.content = renderText(compositionFromVariants(variants));
    resume.updated_at = new Date().toISOString();
  }
  return variants;
}

export const demoApi = {
  resumes: {
    list: async (): Promise<Resume[]> =>
      [...store.resumes].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),

    get: async (id: string): Promise<{ resume: ComposedResume; applications: Application[] }> => {
      const resume = store.resumes.find((r) => r.id === id);
      if (!resume) notFound();
      return {
        resume: { ...resume, sections: hydrateComposition(id) },
        applications: store.applications.filter((a) => a.resume_id === id),
      };
    },

    create: async (input: ResumeInsert): Promise<ComposedResume> => {
      const id = genId();
      const now = new Date().toISOString();
      const resume: Resume = {
        id,
        user_id: 'demo',
        parent_id: input.parent_id ?? null,
        name: input.name,
        content: '',
        tags: input.tags ?? [],
        notes: input.notes ?? '',
        source_file_path: input.source_file_path ?? null,
        created_at: now,
        updated_at: now,
      };
      store.resumes.push(resume);
      const sections = setResumeComposition(id, input.sections ?? []);
      return { ...resume, sections };
    },

    update: async (id: string, patch: ResumeUpdate): Promise<ComposedResume> => {
      const resume = store.resumes.find((r) => r.id === id);
      if (!resume) notFound();
      if (patch.name !== undefined) resume.name = patch.name;
      if (patch.tags !== undefined) resume.tags = patch.tags;
      if (patch.notes !== undefined) resume.notes = patch.notes;
      resume.updated_at = new Date().toISOString();
      const sections =
        patch.sections !== undefined ? setResumeComposition(id, patch.sections) : hydrateComposition(id);
      return { ...resume, sections };
    },

    delete: async (id: string): Promise<{ success: true }> => {
      store.resumes = store.resumes.filter((r) => r.id !== id);
      store.resumeSections = store.resumeSections.filter((rs) => rs.resume_id !== id);
      store.applications.forEach((a) => {
        if (a.resume_id === id) a.resume_id = null;
      });
      return { success: true };
    },

    render: async (id: string, format: 'html' | 'tex', scale: number): Promise<string> => {
      const resume = store.resumes.find((r) => r.id === id);
      if (!resume) notFound();
      const composition = compositionFromVariants(hydrateComposition(id));
      return format === 'tex' ? renderLatex(composition) : renderHtml(composition, { scale });
    },

    matchKeywords: async (input: { resume_id?: string; resume_text?: string; job_text: string }) => {
      let resumeText = input.resume_text ?? '';
      if (input.resume_id) {
        const resume = store.resumes.find((r) => r.id === input.resume_id);
        if (!resume) notFound();
        resumeText = resume.content;
      }
      return runMatchKeywords(resumeText, input.job_text);
    },
  },

  sections: {
    list: async (kind?: SectionKind): Promise<SectionVariant[]> => {
      const list = kind ? store.variants.filter((v) => v.kind === kind) : store.variants;
      return [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    },

    create: async (input: SectionVariantInsert): Promise<SectionVariant> => {
      const now = new Date().toISOString();
      const variant: SectionVariant = {
        id: genId(),
        user_id: 'demo',
        kind: input.kind,
        label: input.label,
        data: input.data ?? {},
        created_at: now,
        updated_at: now,
      };
      store.variants.push(variant);
      return variant;
    },

    update: async (id: string, patch: SectionVariantUpdate): Promise<SectionVariant> => {
      const variant = store.variants.find((v) => v.id === id);
      if (!variant) notFound();
      if (patch.label !== undefined) variant.label = patch.label;
      if (patch.data !== undefined) variant.data = patch.data;
      variant.updated_at = new Date().toISOString();
      return variant;
    },

    delete: async (id: string): Promise<{ success: true }> => {
      store.variants = store.variants.filter((v) => v.id !== id);
      const affectedResumeIds = new Set(
        store.resumeSections.filter((rs) => rs.variant_id === id).map((rs) => rs.resume_id)
      );
      store.resumeSections = store.resumeSections.filter((rs) => rs.variant_id !== id);
      affectedResumeIds.forEach((resumeId) => {
        const resume = store.resumes.find((r) => r.id === resumeId);
        if (resume) resume.content = renderText(compositionFromVariants(hydrateComposition(resumeId)));
      });
      return { success: true };
    },
  },

  interviews: {
    list: async (applicationId?: string): Promise<Interview[]> => {
      const list = applicationId
        ? store.interviews.filter((i) => i.application_id === applicationId)
        : store.interviews;
      return [...list].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    },

    create: async (input: InterviewInsert): Promise<Interview> => {
      const now = new Date().toISOString();
      const interview: Interview = {
        id: genId(),
        user_id: 'demo',
        application_id: input.application_id,
        scheduled_at: input.scheduled_at ?? null,
        kind: input.kind ?? null,
        notes: input.notes ?? '',
        outcome: input.outcome ?? null,
        created_at: now,
        updated_at: now,
      };
      store.interviews.push(interview);
      return interview;
    },

    update: async (id: string, patch: InterviewUpdate): Promise<Interview> => {
      const interview = store.interviews.find((i) => i.id === id);
      if (!interview) notFound();
      if (patch.scheduled_at !== undefined) interview.scheduled_at = patch.scheduled_at;
      if (patch.kind !== undefined) interview.kind = patch.kind;
      if (patch.notes !== undefined) interview.notes = patch.notes;
      if (patch.outcome !== undefined) interview.outcome = patch.outcome;
      interview.updated_at = new Date().toISOString();
      return interview;
    },

    delete: async (id: string): Promise<{ success: true }> => {
      store.interviews = store.interviews.filter((i) => i.id !== id);
      return { success: true };
    },
  },

  applications: {
    list: async (filters?: {
      status?: ApplicationStatus;
      resume_id?: string;
      search?: string;
    }): Promise<Application[]> => {
      let list = [...store.applications];
      if (filters?.status) list = list.filter((a) => a.status === filters.status);
      if (filters?.resume_id) list = list.filter((a) => a.resume_id === filters.resume_id);
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        list = list.filter(
          (a) => a.company.toLowerCase().includes(q) || (a.role ?? '').toLowerCase().includes(q)
        );
      }
      return list.sort((a, b) => +new Date(b.date_applied) - +new Date(a.date_applied));
    },

    create: async (input: ApplicationInsert): Promise<Application> => {
      const now = new Date().toISOString();
      const application: Application = {
        id: genId(),
        user_id: 'demo',
        resume_id: input.resume_id ?? null,
        company: input.company,
        role: input.role ?? null,
        status: input.status ?? 'applied',
        notes: input.notes ?? '',
        date_applied: input.date_applied ?? now,
        created_at: now,
        updated_at: now,
      };
      store.applications.push(application);
      return application;
    },

    update: async (id: string, patch: ApplicationUpdate): Promise<Application> => {
      const application = store.applications.find((a) => a.id === id);
      if (!application) notFound();
      if (patch.company !== undefined) application.company = patch.company;
      if (patch.role !== undefined) application.role = patch.role;
      if (patch.resume_id !== undefined) application.resume_id = patch.resume_id;
      if (patch.status !== undefined) application.status = patch.status;
      if (patch.notes !== undefined) application.notes = patch.notes;
      if (patch.date_applied !== undefined) application.date_applied = patch.date_applied;
      application.updated_at = new Date().toISOString();
      return application;
    },

    delete: async (id: string): Promise<{ success: true }> => {
      store.applications = store.applications.filter((a) => a.id !== id);
      store.interviews = store.interviews.filter((i) => i.application_id !== id);
      return { success: true };
    },
  },

  analytics: {
    get: async () => {
      const apps = store.applications;
      const total = apps.length;
      const callbacks = apps.filter((a) => a.status === 'interviewing' || a.status === 'offer').length;
      const offers = apps.filter((a) => a.status === 'offer').length;

      const byVersion: VersionStat[] = store.resumes.map((r) => {
        const rApps = apps.filter((a) => a.resume_id === r.id);
        const applied = rApps.length;
        const rCallbacks = rApps.filter((a) => a.status === 'interviewing' || a.status === 'offer').length;
        return {
          resume_id: r.id,
          user_id: 'demo',
          resume_name: r.name,
          applied,
          callbacks: rCallbacks,
          offers: rApps.filter((a) => a.status === 'offer').length,
          rejected: rApps.filter((a) => a.status === 'rejected').length,
          ghosted: rApps.filter((a) => a.status === 'ghosted').length,
          callback_rate_pct: applied > 0 ? Math.round((rCallbacks / applied) * 1000) / 10 : 0,
        };
      });
      byVersion.sort((a, b) => b.callback_rate_pct - a.callback_rate_pct);

      return {
        overall: {
          total_applications: total,
          callbacks,
          offers,
          callback_rate_pct: total > 0 ? Math.round((callbacks / total) * 100) : 0,
        },
        by_version: byVersion,
      };
    },
  },

  auth: {
    signOut: async (): Promise<{ success: true }> => ({ success: true }),
  },
};
