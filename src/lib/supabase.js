import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Only create client if both values are present
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null
// ──────────────────────────────────────────────
// DATABASE SCHEMA (run in Supabase SQL editor)
// ──────────────────────────────────────────────
/*
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Books table
create table books (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  author text,
  cover_url text,
  description text,
  genre text,
  shelf text default 'reading' check (shelf in ('reading','finished','wishlist','paused')),
  progress integer default 0 check (progress >= 0 and progress <= 100),
  pages_total integer default 0,
  pages_read integer default 0,
  google_books_id text,
  epub_path text,
  rating integer check (rating >= 1 and rating <= 5),
  review text,
  date_started date,
  date_finished date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Highlights table
create table highlights (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  text text not null,
  color text default 'yellow',
  cfi text,
  page_info text,
  note text,
  created_at timestamptz default now()
);

-- Bookmarks table
create table bookmarks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  cfi text,
  label text,
  page_info text,
  created_at timestamptz default now()
);

-- Quotes journal table
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  book_id uuid references books(id) on delete set null,
  text text not null,
  book_title text,
  author text,
  created_at timestamptz default now()
);

-- Reading sessions (for heatmap & stats)
create table reading_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  book_id uuid references books(id) on delete cascade,
  date date default current_date,
  minutes integer default 0,
  pages_read integer default 0,
  created_at timestamptz default now()
);

-- Reading goals
create table reading_goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  type text check (type in ('monthly','yearly')),
  target integer not null,
  year integer,
  month integer,
  created_at timestamptz default now()
);

-- Row Level Security
alter table books enable row level security;
alter table highlights enable row level security;
alter table bookmarks enable row level security;
alter table quotes enable row level security;
alter table reading_sessions enable row level security;
alter table reading_goals enable row level security;

create policy "Users see own books" on books for all using (auth.uid() = user_id);
create policy "Users see own highlights" on highlights for all using (auth.uid() = user_id);
create policy "Users see own bookmarks" on bookmarks for all using (auth.uid() = user_id);
create policy "Users see own quotes" on quotes for all using (auth.uid() = user_id);
create policy "Users see own sessions" on reading_sessions for all using (auth.uid() = user_id);
create policy "Users see own goals" on reading_goals for all using (auth.uid() = user_id);

-- Storage bucket for epub files
insert into storage.buckets (id, name, public) values ('epubs', 'epubs', false);
create policy "Users upload own epubs" on storage.objects for insert with check (bucket_id = 'epubs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users read own epubs" on storage.objects for select using (bucket_id = 'epubs' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete own epubs" on storage.objects for delete using (bucket_id = 'epubs' and auth.uid()::text = (storage.foldername(name))[1]);
*/
