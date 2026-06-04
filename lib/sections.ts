// ============================================================
// lib/sections.ts
// ============================================================
// The single source of truth for the section model: the kinds,
// their structured data shapes, the canonical section titles and
// ordering (mirroring jake.txt), and the metadata the guided
// editors use to render the right "slots" for each kind.
//
// Both the server (rendering, validation) and the client (editors,
// builder) import from here so the shape never drifts.
// ============================================================

export type SectionKind =
  | 'header'
  | 'education'
  | 'coursework'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'leadership';

// The order sections appear on the page by default (Jake's order).
// `header` is always first and rendered as the centered heading.
export const SECTION_ORDER: SectionKind[] = [
  'header',
  'education',
  'coursework',
  'experience',
  'projects',
  'skills',
  'leadership',
];

// Canonical \section{} titles, straight from jake.txt.
export const SECTION_TITLE: Record<SectionKind, string> = {
  header: 'Header',
  education: 'Education',
  coursework: 'Relevant Coursework',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Technical Skills',
  leadership: 'Leadership / Extracurricular',
};

// A one-line description shown in the library / builder.
export const SECTION_BLURB: Record<SectionKind, string> = {
  header: 'Name and contact line — the centered heading.',
  education: 'Schools, degrees, dates, and locations.',
  coursework: 'A flat list of relevant courses (4-column).',
  experience: 'Roles: company, title, dates, location, bullets.',
  projects: 'Projects: name, tech stack, date, bullets.',
  skills: 'Skill categories, each with a list of items.',
  leadership: 'Like experience, for orgs and extracurriculars.',
};

// ------------------------------------------------------------
// Structured data shapes (the `data` jsonb on a variant).
// ------------------------------------------------------------
export interface HeaderData {
  name: string;
  location?: string; // "123 Street Name, Town, State 12345" or "City, State"
  phone?: string;
  email?: string;
  linkedin?: string; // "linkedin.com/in/username"
  github?: string; // "github.com/username"
  website?: string; // "mysite.com"
}

export interface EducationItem {
  school: string;
  degree: string; // "Bachelor of Science in Computer Science"
  dateRange: string; // "Sep. 2017 -- May 2021"
  location: string; // "City, State"
}
export interface EducationData {
  items: EducationItem[];
}

export interface CourseworkData {
  courses: string[];
}

export interface ExperienceItem {
  company: string;
  title: string;
  dateRange: string;
  location: string;
  bullets: string[];
}
export interface ExperienceData {
  items: ExperienceItem[];
}

export interface ProjectItem {
  name: string;
  tech: string; // "Python, Selenium, Google Cloud Console"
  date: string;
  bullets: string[];
}
export interface ProjectsData {
  items: ProjectItem[];
}

export interface SkillCategoryItem {
  category: string; // "Languages"
  items: string; // "Python, Java, C, HTML/CSS, JavaScript, SQL"
}
export interface SkillsData {
  categories: SkillCategoryItem[];
}

export interface LeadershipItem {
  organization: string;
  role: string;
  dateRange: string;
  location: string;
  bullets: string[];
}
export interface LeadershipData {
  items: LeadershipItem[];
}

export type SectionData =
  | HeaderData
  | EducationData
  | CourseworkData
  | ExperienceData
  | ProjectsData
  | SkillsData
  | LeadershipData;

// A section variant as stored in the DB.
export interface SectionVariant {
  id: string;
  user_id: string;
  kind: SectionKind;
  label: string;
  data: SectionData;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// Empty templates — what a brand-new variant starts with. The
// guided editors render these as a single empty "slot" so the
// user is never staring at a blank box.
// ------------------------------------------------------------
export function emptyItemFor(kind: SectionKind): any {
  switch (kind) {
    case 'education':
      return { school: '', degree: '', dateRange: '', location: '' };
    case 'experience':
      return { company: '', title: '', dateRange: '', location: '', bullets: [''] };
    case 'projects':
      return { name: '', tech: '', date: '', bullets: [''] };
    case 'skills':
      return { category: '', items: '' };
    case 'leadership':
      return { organization: '', role: '', dateRange: '', location: '', bullets: [''] };
    default:
      return {};
  }
}

export function emptyDataFor(kind: SectionKind): SectionData {
  switch (kind) {
    case 'header':
      return { name: '', location: '', phone: '', email: '', linkedin: '', github: '', website: '' };
    case 'coursework':
      return { courses: [''] };
    case 'education':
    case 'experience':
    case 'projects':
    case 'leadership':
      return { items: [emptyItemFor(kind)] };
    case 'skills':
      return { categories: [emptyItemFor('skills')] };
  }
}

// ------------------------------------------------------------
// Guided-editor field metadata. The editors read these to render
// labelled inputs with helpful placeholders ("assist the user to
// what to put in each category").
// ------------------------------------------------------------
export interface FieldSpec {
  key: string;
  label: string;
  placeholder: string;
  // 'text' = single line, 'bullets' = repeatable bullet list
  type?: 'text' | 'bullets';
  hint?: string;
}

// For item-list kinds, the per-item field layout (left/right columns
// mirror Jake's two-column subheadings).
export const ITEM_FIELDS: Partial<Record<SectionKind, FieldSpec[]>> = {
  education: [
    { key: 'school', label: 'University', placeholder: 'State University' },
    { key: 'dateRange', label: 'Dates', placeholder: 'Sep. 2017 – May 2021' },
    { key: 'degree', label: 'Degree', placeholder: 'Bachelor of Science in Computer Science' },
    { key: 'location', label: 'Location', placeholder: 'City, State' },
  ],
  experience: [
    { key: 'company', label: 'Company', placeholder: 'Electronics Company' },
    { key: 'dateRange', label: 'Dates', placeholder: 'May 2020 – August 2020' },
    { key: 'title', label: 'Title', placeholder: 'Software Engineer Intern' },
    { key: 'location', label: 'Location', placeholder: 'City, State' },
    { key: 'bullets', label: 'Bullet points', placeholder: 'Developed a service that…', type: 'bullets' },
  ],
  projects: [
    { key: 'name', label: 'Project name', placeholder: 'Gym Reservation Bot' },
    { key: 'date', label: 'Date', placeholder: 'January 2021' },
    { key: 'tech', label: 'Technologies', placeholder: 'Python, Selenium, Google Cloud', hint: 'Shown italic after the name, like Jake’s template.' },
    { key: 'bullets', label: 'Bullet points', placeholder: 'Developed an automatic bot that…', type: 'bullets' },
  ],
  leadership: [
    { key: 'organization', label: 'Organization', placeholder: 'Fraternity' },
    { key: 'dateRange', label: 'Dates', placeholder: 'Spring 2020 – Present' },
    { key: 'role', label: 'Role', placeholder: 'President' },
    { key: 'location', label: 'Location', placeholder: 'University Name' },
    { key: 'bullets', label: 'Bullet points', placeholder: 'Managed an executive board of…', type: 'bullets' },
  ],
  skills: [
    { key: 'category', label: 'Category', placeholder: 'Languages' },
    { key: 'items', label: 'Items', placeholder: 'Python, Java, C, HTML/CSS, JavaScript, SQL' },
  ],
};

export const HEADER_FIELDS: FieldSpec[] = [
  { key: 'name', label: 'Full name', placeholder: 'First Last' },
  { key: 'location', label: 'Location', placeholder: '123 Street Name, Town, State 12345' },
  { key: 'phone', label: 'Phone', placeholder: '123-456-7890' },
  { key: 'email', label: 'Email', placeholder: 'email@gmail.com' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
  { key: 'github', label: 'GitHub', placeholder: 'github.com/username' },
  { key: 'website', label: 'Website (optional)', placeholder: 'mysite.com' },
];

// Whether a kind is an ordered list of repeatable items.
export function isItemList(kind: SectionKind): boolean {
  return (
    kind === 'education' ||
    kind === 'experience' ||
    kind === 'projects' ||
    kind === 'leadership'
  );
}

// Noun for one item, used in the "+ Add ___" editor buttons.
export const ITEM_NOUN: Record<SectionKind, string> = {
  header: 'header',
  education: 'school',
  coursework: 'course',
  experience: 'role',
  projects: 'project',
  skills: 'category',
  leadership: 'entry',
};

// A short, human summary of a variant's content for list rows.
export function summarizeVariant(kind: SectionKind, data: any): string {
  if (!data) return 'Empty';
  switch (kind) {
    case 'header':
      return data.name || 'Unnamed';
    case 'coursework':
      return `${(data.courses || []).filter(Boolean).length} courses`;
    case 'skills':
      return (data.categories || []).map((c: SkillCategoryItem) => c.category).filter(Boolean).join(', ') || 'No categories';
    case 'education':
      return (data.items || []).map((i: EducationItem) => i.school).filter(Boolean).join(', ') || 'No schools';
    case 'experience':
      return (data.items || []).map((i: ExperienceItem) => i.company).filter(Boolean).join(', ') || 'No roles';
    case 'projects':
      return (data.items || []).map((i: ProjectItem) => i.name).filter(Boolean).join(', ') || 'No projects';
    case 'leadership':
      return (data.items || []).map((i: LeadershipItem) => i.organization).filter(Boolean).join(', ') || 'No entries';
  }
}
