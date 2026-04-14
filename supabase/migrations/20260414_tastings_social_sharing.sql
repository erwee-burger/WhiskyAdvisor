create table if not exists tasting_people (
  id text primary key,
  name text not null,
  relationship_type text not null check (relationship_type in ('friend', 'family', 'colleague', 'other')),
  preference_tags text[] not null default '{}'::text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasting_groups (
  id text primary key,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasting_group_members (
  id text primary key,
  group_id text not null references tasting_groups(id) on delete cascade,
  person_id text not null references tasting_people(id) on delete cascade
);

create unique index if not exists tasting_group_members_group_person_idx
  on tasting_group_members (group_id, person_id);

create table if not exists tasting_places (
  id text primary key,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasting_sessions (
  id text primary key,
  title text,
  occasion_type text not null check (occasion_type in ('visit', 'whisky_friday', 'other')),
  session_date timestamptz not null,
  place_id text references tasting_places(id) on delete set null,
  group_id text references tasting_groups(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasting_sessions_session_date_idx
  on tasting_sessions (session_date desc);

create table if not exists tasting_session_attendees (
  id text primary key,
  session_id text not null references tasting_sessions(id) on delete cascade,
  person_id text not null references tasting_people(id) on delete cascade
);

create unique index if not exists tasting_session_attendees_session_person_idx
  on tasting_session_attendees (session_id, person_id);

create table if not exists tasting_session_bottles (
  id text primary key,
  session_id text not null references tasting_sessions(id) on delete cascade,
  collection_item_id text not null references collection_items(id) on delete cascade
);

create unique index if not exists tasting_session_bottles_session_item_idx
  on tasting_session_bottles (session_id, collection_item_id);
