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

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: 'free' | 'plus';
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
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
};

export type ResumeUpdate = Partial<ResumeInsert>;

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
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Subscription>;
        Relationships: [];
      };
    };
    Views: {
      version_stats: { Row: VersionStat; Relationships: [] };
    };
    Functions: Record<string, never>;
    Enums: {
      application_status: ApplicationStatus;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
