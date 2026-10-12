-- ============================================================
-- IMPI Job Cards — Neon (Postgres) schema
-- Paste into the Neon SQL Editor and run once.
-- ============================================================
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text not null default 'Unnamed Staff',
  role text not null default 'staff' check (role in ('admin','hr','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists job_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles(id) on delete cascade,
  site_id uuid references sites(id),
  site_name_other text,
  sign_in_at timestamptz not null default now(),
  sign_in_offline boolean not null default false,
  sign_out_at timestamptz,
  sign_out_offline boolean not null default false,
  notes text,
  closed_manually boolean not null default false,
  close_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_specified check (site_id is not null or site_name_other is not null)
);

create index if not exists idx_job_entries_staff on job_entries(staff_id);
create index if not exists idx_job_entries_sign_in on job_entries(sign_in_at);

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_job_entries_updated on job_entries;
create trigger trg_job_entries_updated before update on job_entries
  for each row execute procedure set_updated_at();

-- Optional starter sites (edit/remove as needed)
insert into sites (name) values
  ('Menlyn Park Shopping Centre'),
  ('Nasonti / Goedehoop Mine')
on conflict (name) do nothing;
-- Access control is enforced in the /api functions (no Supabase RLS on Neon).
