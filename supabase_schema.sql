create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  display_name text,
  avatar_url text,
  provider text,
  github_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  description text not null default '',
  logo text not null default '',
  custom_rules text not null default '',
  preview_mode text not null default 'webcontainer',
  env_vars jsonb not null default '[]'::jsonb,
  github_repo text not null default '',
  github_branch text not null default 'main',
  github_token text not null default '',
  netlify_config jsonb not null default '{}'::jsonb,
  vercel_config jsonb not null default '{}'::jsonb,
  cloudrun_config jsonb not null default '{}'::jsonb,
  database_config jsonb not null default '{}'::jsonb,
  google_drive_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  path text not null,
  content text not null default '',
  is_binary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);

create table if not exists public.recently_viewed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  unique (user_id, project_id)
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_files enable row level security;
alter table public.recently_viewed enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "projects_select_own" on public.projects
for select using (auth.uid() = owner_id);

create policy "projects_insert_own" on public.projects
for insert with check (auth.uid() = owner_id);

create policy "projects_update_own" on public.projects
for update using (auth.uid() = owner_id);

create policy "projects_delete_own" on public.projects
for delete using (auth.uid() = owner_id);

create policy "files_select_own" on public.project_files
for select using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.owner_id = auth.uid()
  )
);

create policy "files_insert_own" on public.project_files
for insert with check (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.owner_id = auth.uid()
  )
);

create policy "files_update_own" on public.project_files
for update using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.owner_id = auth.uid()
  )
);

create policy "files_delete_own" on public.project_files
for delete using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.owner_id = auth.uid()
  )
);

create policy "recently_viewed_select_own" on public.recently_viewed
for select using (auth.uid() = user_id);

create policy "recently_viewed_insert_own" on public.recently_viewed
for insert with check (auth.uid() = user_id);

create policy "recently_viewed_delete_own" on public.recently_viewed
for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_project_files_updated_at
before update on public.project_files
for each row execute function public.set_updated_at();
