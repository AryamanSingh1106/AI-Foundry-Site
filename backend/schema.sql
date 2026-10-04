-- AI Foundry database schema.
-- Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('up', 'past')),   -- upcoming / past
  date_label text,                                     -- shown on site, e.g. 'TBA · 2026'
  time_label text,
  venue text,
  title text not null,
  short text,                                          -- one-line summary
  long text,                                           -- full description
  highlights text[] not null default '{}',
  link text,
  img text,
  gallery text[] not null default '{}',
  sort_order int not null default 0,                   -- lower number shows first
  published boolean not null default true,             -- false = hidden draft
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('on', 'done')),   -- ongoing / completed
  type text not null check (type in ('Project', 'Research')),
  title text not null,
  short text,
  long text,
  stage smallint check (stage between 0 and 3),        -- 0 Discover .. 3 Impact
  progress smallint check (progress between 0 and 100),
  tech text[] not null default '{}',
  lead text,
  date_label text,
  highlights text[] not null default '{}',
  link text,
  img text,
  gallery text[] not null default '{}',
  sort_order int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  photo text,
  sort_order int not null default 0,
  published boolean not null default true
);

create table if not exists leaders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  email text,
  photo text,
  sort_order int not null default 0
);

create table if not exists collabs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_real boolean not null default false,              -- true = shown bright
  logo text,
  sort_order int not null default 0
);

-- One-off blocks (patron message, manifesto sentence): key + JSON value.
create table if not exists site_settings (
  key text primary key,
  value jsonb not null
);

-- Join form submissions.
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text not null,
  resume_path text not null,                           -- file path inside the private 'resumes' bucket
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'accepted', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

-- SECURITY: turn on Row Level Security with NO policies.
-- That blocks all direct access using the public (anon) key.
-- Only our FastAPI server (which uses the secret service_role key) can read/write.
alter table events         enable row level security;
alter table projects       enable row level security;
alter table members        enable row level security;
alter table leaders        enable row level security;
alter table collabs        enable row level security;
alter table site_settings  enable row level security;
alter table applications   enable row level security;

-- Private storage bucket for resumes (not public).
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;
