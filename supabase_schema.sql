-- Supabase SQL Schema for Church Unit Report Management Platform

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. TABLES DEFINITIONS
-- ==========================================

-- Church units
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'frozen'
    check (status in ('active', 'frozen', 'deactivated')),
  created_at timestamptz default now()
);

-- User profiles (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null check (role in ('admin', 'unit_head')),
  is_super_admin boolean not null default false,
  unit_id uuid references public.units(id) on delete set null,
  email text not null,
  phone_number text,
  avatar_url text,
  account_status text not null default 'pending'
    check (account_status in ('pending', 'active', 'suspended')),
  is_first_login boolean not null default true,
  telegram_chat_id text,
  telegram_linked boolean not null default false,
  telegram_link_code text,
  telegram_link_code_expires_at timestamptz,
  created_at timestamptz default now(),
  -- Ensure only one unit head per unit
  constraint unique_unit_head unique (unit_id)
);

-- Monthly deadlines
create table if not exists public.report_deadlines (
  id uuid primary key default gen_random_uuid(),
  month date not null, -- always the 1st of the reporting month
  deadline_date date not null, -- default: first Saturday of the following month
  first_reminder_sent boolean not null default false, -- true = deadline is now locked
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique (month)
);

-- Reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  month date not null, -- first day of the reporting month
  content_text text, -- populated if submitted via text editor
  file_url text, -- Supabase Storage path
  file_type text check (file_type in ('pdf', 'docx', 'md', 'text')),
  is_late boolean not null default false,
  version integer not null default 1,
  is_latest boolean not null default true,
  parsed_text text, -- raw text extracted from document
  ai_summary jsonb, -- {summary, breakthroughs, issues, progress, critical_alerts, completeness_score}
  ai_status text not null default 'pending'
    check (ai_status in ('pending', 'processing', 'done', 'failed')),
  submitted_at timestamptz default now(),
  unique (unit_id, month, version)
);

-- Admin comments/feedback on reports
create table if not exists public.report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  comment text not null,
  created_at timestamptz default now()
);

-- Cross-unit monthly summaries
create table if not exists public.monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  month date not null unique,
  overall_summary text,
  common_issues jsonb,
  common_breakthroughs jsonb,
  critical_alerts jsonb,
  cross_unit_themes jsonb,
  unit_highlights jsonb, -- [{ unit_id, unit_name, highlight }]
  generated_at timestamptz,
  ai_status text default 'pending'
    check (ai_status in ('pending', 'processing', 'done', 'failed'))
);

-- Notification log
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  month date not null,
  reminder_sequence integer not null check (reminder_sequence in (1, 2, 3)),
  email_sent boolean default false,
  telegram_sent boolean default false,
  sent_at timestamptz default now(),
  unique (unit_id, month, reminder_sequence)
);

-- ==========================================
-- 2. INDEXES
-- ==========================================
create index if not exists idx_profiles_unit_id on public.profiles(unit_id);
create index if not exists idx_reports_unit_month on public.reports(unit_id, month);
create index if not exists idx_reports_is_latest on public.reports(is_latest);
create index if not exists idx_report_comments_report_id on public.report_comments(report_id);
create index if not exists idx_notification_log_lookup on public.notification_log(unit_id, month, reminder_sequence);

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.report_deadlines enable row level security;
alter table public.reports enable row level security;
alter table public.report_comments enable row level security;
alter table public.monthly_summaries enable row level security;
alter table public.notification_log enable row level security;

-- Helper Functions to get current user's profile details
create or replace function public.get_current_user_profile()
returns public.profiles as $$
  select * from public.profiles where id = auth.uid();
$$ language sql security definer;

-- --- UNITS POLICIES ---
create policy "Admins have full access to units" 
  on public.units for all 
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Unit heads can read their own unit" 
  on public.units for select 
  using (id = (select unit_id from public.profiles where id = auth.uid()));

-- --- PROFILES POLICIES ---
create policy "Users can read their own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins can view and edit all profiles"
  on public.profiles for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- --- REPORT DEADLINES POLICIES ---
create policy "Admins have full access to report deadlines"
  on public.report_deadlines for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Unit heads can read report deadlines"
  on public.report_deadlines for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'unit_head'));

-- --- REPORTS POLICIES ---
create policy "Admins can view all reports"
  on public.reports for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Admins can update reports (e.g. update AI status or AI summary via admin APIs, although usually done via service role)
create policy "Admins can update reports"
  on public.reports for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Unit heads can view their own unit's reports"
  on public.reports for select
  using (unit_id = (select unit_id from public.profiles where id = auth.uid()));

create policy "Unit heads can insert their own unit's reports"
  on public.reports for insert
  with check (
    unit_id = (select unit_id from public.profiles where id = auth.uid())
    and submitted_by = auth.uid()
  );

create policy "Unit heads can update their own unit's reports"
  on public.reports for update
  using (
    unit_id = (select unit_id from public.profiles where id = auth.uid())
    and submitted_by = auth.uid()
  );

-- --- REPORT COMMENTS POLICIES ---
create policy "Admins can view and manage all comments"
  on public.report_comments for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Unit heads can view comments on their own reports"
  on public.report_comments for select
  using (
    exists (
      select 1 from public.reports r
      where r.id = report_comments.report_id
      and r.unit_id = (select unit_id from public.profiles where id = auth.uid())
    )
  );

-- --- MONTHLY SUMMARIES POLICIES ---
create policy "Admins have full access to monthly summaries"
  on public.monthly_summaries for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- --- NOTIFICATION LOG POLICIES ---
create policy "Admins can view notification logs"
  on public.notification_log for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
