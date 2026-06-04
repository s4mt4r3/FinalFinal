// ============================================================
// Database types
// ============================================================
// These mirror the Postgres schema. In a real project you'd
// generate this file automatically with:
//
//   npx supabase gen types typescript --linked > types/database.ts
//
// But the hand-written version below is fine to start, and it
// teaches you what the schema looks like.
// ============================================================

export type ApplicationStatus =
  | 'applied'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'ghosted';

export interface Profile {
  id: string;            // uuid, matches auth.users.id
  email: string;
  display_name: string | null;
  created_at: string;    // ISO timestamp
  updated_at: string;
}

export interface Resume {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  content: string;
  tags: string[];
  notes: string;
  source_file_path: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------
// Section model (the redesigned core)
// ------------------------------------------------------------
export type SectionKind =
  | 'header'
  | 'education'
  | 'coursework'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'leadership';

// A reusable, versioned section block. `data` is structured JSON
// whose shape depends on `kind` (see lib/sections.ts).
export interface SectionVariant {
  id: string;
  user_id: string;
  kind: SectionKind;
  label: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Join row: a variant placed in a resume composition at a position.
export interface ResumeSection {
  id: string;
  resume_id: string;
  variant_id: string;
  position: number;
  created_at: string;
}

export type SectionVariantInsert = {
  kind: SectionKind;
  label: string;
  data?: Record<string, unknown>;
};
export type SectionVariantUpdate = Partial<Pick<SectionVariantInsert, 'label' | 'data'>>;

export interface Application {
  id: string;
  user_id: string;
  resume_id: string | null;
  company: string;
  role: string | null;
  status: ApplicationStatus;
  notes: string;
  date_applied: string;
  created_at: string;
  updated_at: string;
}

export interface VersionStat {
  resume_id: string;
  user_id: string;
  resume_name: string;
  applied: number;
  callbacks: number;
  offers: number;
  rejected: number;
  ghosted: number;
  callback_rate_pct: number;
}

export interface Interview {
  id: string;
  user_id: string;
  application_id: string;
  scheduled_at: string | null;
  kind: string | null;
  notes: string;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

export type InterviewInsert = {
  application_id: string;
  scheduled_at?: string | null;
  kind?: string | null;
  notes?: string;
  outcome?: string | null;
};

export type InterviewUpdate = Partial<InterviewInsert>;

// ------------------------------------------------------------
// "Insert" shapes — what you send when creating a row.
// id, user_id, and timestamps are filled in by the server.
// ------------------------------------------------------------
export type ResumeInsert = {
  name: string;
  content?: string;
  parent_id?: string | null;
  tags?: string[];
  notes?: string;
  source_file_path?: string | null;
  // Composition: ordered variant ids that make up this resume.
  sections?: string[];
};

export type ResumeUpdate = Partial<ResumeInsert>;

// A composed resume as returned by the API: the row plus the
// ordered, hydrated section variants that make it up.
export interface ComposedResume extends Resume {
  sections: SectionVariant[];
}

export type ApplicationInsert = {
  company: string;
  role?: string | null;
  resume_id?: string | null;
  status?: ApplicationStatus;
  notes?: string;
  date_applied?: string;
};

export type ApplicationUpdate = Partial<ApplicationInsert>;

// ------------------------------------------------------------
// Supabase Database typing
// ------------------------------------------------------------
// This is the shape the supabase-js client expects so its
// `.from('resumes')` calls are fully typed.
// ------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      resumes: {
        Row: Resume;
        Insert: ResumeInsert & { user_id: string };
        Update: ResumeUpdate;
        Relationships: [];
      };
      applications: {
        Row: Application;
        Insert: ApplicationInsert & { user_id: string };
        Update: ApplicationUpdate;
        Relationships: [];
      };
      interviews: {
        Row: Interview;
        Insert: InterviewInsert & { user_id: string };
        Update: InterviewUpdate;
        Relationships: [];
      };
      section_variants: {
        Row: SectionVariant;
        Insert: SectionVariantInsert & { user_id: string };
        Update: SectionVariantUpdate;
        Relationships: [];
      };
      resume_sections: {
        Row: ResumeSection;
        Insert: { resume_id: string; variant_id: string; position?: number };
        Update: Partial<{ position: number }>;
        Relationships: [];
      };
    };
    Views: {
      version_stats: { Row: VersionStat; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      application_status: ApplicationStatus;
      section_kind: SectionKind;
    };
    CompositeTypes: Record<string, never>;
  };
}
