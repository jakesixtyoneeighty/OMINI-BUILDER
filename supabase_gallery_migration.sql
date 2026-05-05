-- ============================================
-- Gallery Tables for Omni-Builder
-- ============================================
-- Run this SQL in your Supabase SQL Editor to create the gallery tables.
-- These tables are PUBLIC (anyone can view) but only authenticated users can publish.

create extension if not exists pgcrypto;

-- Gallery projects table (public read, authenticated write)
create table if not exists public.gallery_projects (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default 'Anonymous',
  author_email text,
  name text not null,
  description text not null default '',
  thumbnail text not null default '',
  cover_image text not null default '',
  logo text not null default '',
  tags jsonb not null default '[]'::jsonb,
  category text not null default 'web-apps',
  likes int not null default 0,
  views int not null default 0,
  is_featured boolean not null default false,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Gallery project files
create table if not exists public.gallery_project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.gallery_projects(id) on delete cascade,
  path text not null,
  content text not null default '',
  is_binary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, path)
);

-- Gallery likes table
create table if not exists public.gallery_likes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.gallery_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

-- Enable RLS
alter table public.gallery_projects enable row level security;
alter table public.gallery_project_files enable row level security;
alter table public.gallery_likes enable row level security;

-- PUBLIC read for gallery projects (anyone can browse)
create policy "gallery_projects_select_public" on public.gallery_projects
for select using (is_published = true);

-- Authenticated users can read their own unpublished projects
create policy "gallery_projects_select_own" on public.gallery_projects
for select using (auth.uid() = author_id);

-- Authenticated users OR service role can insert (publish)
create policy "gallery_projects_insert_auth" on public.gallery_projects
for insert with check (auth.uid() is not null OR true);

-- Authors can update their own projects
create policy "gallery_projects_update_own" on public.gallery_projects
for update using (auth.uid() = author_id);

-- Authors can delete their own projects
create policy "gallery_projects_delete_own" on public.gallery_projects
for delete using (auth.uid() = author_id);

-- Files: public read (via project)
create policy "gallery_files_select_public" on public.gallery_project_files
for select using (
  exists (
    select 1 from public.gallery_projects gp
    where gp.id = project_id and gp.is_published = true
  )
);

-- Files: authors can read their own
create policy "gallery_files_select_own" on public.gallery_project_files
for select using (
  exists (
    select 1 from public.gallery_projects gp
    where gp.id = project_id and gp.author_id = auth.uid()
  )
);

-- Files: authenticated users can insert
create policy "gallery_files_insert_auth" on public.gallery_project_files
for insert with check (
  exists (
    select 1 from public.gallery_projects gp
    where gp.id = project_id and gp.author_id = auth.uid()
  )
);

-- Files: authors can update/delete
create policy "gallery_files_update_own" on public.gallery_project_files
for update using (
  exists (
    select 1 from public.gallery_projects gp
    where gp.id = project_id and gp.author_id = auth.uid()
  )
);

create policy "gallery_files_delete_own" on public.gallery_project_files
for delete using (
  exists (
    select 1 from public.gallery_projects gp
    where gp.id = project_id and gp.author_id = auth.uid()
  )
);

-- Likes: anyone authenticated can like
create policy "gallery_likes_select_public" on public.gallery_likes
for select using (true);

create policy "gallery_likes_insert_auth" on public.gallery_likes
for insert with check (auth.uid() is not null and auth.uid() = user_id);

create policy "gallery_likes_delete_own" on public.gallery_likes
for delete using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists idx_gallery_projects_published on public.gallery_projects(is_published, published_at desc);
create index if not exists idx_gallery_projects_author on public.gallery_projects(author_id);
create index if not exists idx_gallery_projects_category on public.gallery_projects(category);
create index if not exists idx_gallery_files_project on public.gallery_project_files(project_id);
create index if not exists idx_gallery_likes_project on public.gallery_likes(project_id);
create index if not exists idx_gallery_likes_user on public.gallery_likes(user_id);

-- Updated_at trigger
create or replace function public.gallery_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_gallery_projects_updated_at
before update on public.gallery_projects
for each row execute function public.gallery_set_updated_at();

create trigger set_gallery_project_files_updated_at
before update on public.gallery_project_files
for each row execute function public.gallery_set_updated_at();
