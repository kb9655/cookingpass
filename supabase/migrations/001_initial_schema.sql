-- Cooking Pass initial schema
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists "pgcrypto";

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  experience_level text not null default 'beginner'
    check (experience_level in ('beginner', 'intermediate', 'advanced')),
  available_tools text[] not null default '{}',
  preferred_max_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create table public.techniques (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  estimated_minutes integer not null check (estimated_minutes > 0),
  learning_goals text[] not null default '{}',
  required_tools text[] not null default '{}',
  precautions text[] not null default '{}',
  stage_number integer unique not null,
  created_at timestamptz not null default now()
);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('image', 'video', 'thumbnail')),
  storage_path text,
  thumbnail_path text,
  mime_type text,
  file_size integer,
  width integer,
  height integer,
  duration_seconds numeric,
  source_url text,
  source_title text,
  author text,
  license text,
  license_url text,
  attribution_required boolean not null default false,
  commercial_use_allowed boolean not null default true,
  modification_allowed boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.technique_steps (
  id uuid primary key default gen_random_uuid(),
  technique_id uuid not null references public.techniques (id) on delete cascade,
  step_number integer not null,
  title text,
  instruction text not null,
  media_id uuid references public.media (id) on delete set null,
  unique (technique_id, step_number)
);

create table public.technique_relations (
  technique_id uuid not null references public.techniques (id) on delete cascade,
  related_technique_id uuid not null references public.techniques (id) on delete cascade,
  primary key (technique_id, related_technique_id),
  check (technique_id <> related_technique_id)
);

create table public.technique_media (
  technique_id uuid not null references public.techniques (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  role text not null default 'step' check (role in ('cover', 'step', 'thumb')),
  sort_order integer not null default 0,
  primary key (technique_id, media_id)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  estimated_minutes integer not null check (estimated_minutes > 0),
  servings integer not null default 2 check (servings > 0),
  required_tools text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  step_number integer not null,
  instruction text not null,
  technique_id uuid references public.techniques (id) on delete set null,
  unique (recipe_id, step_number)
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  default_unit text not null,
  category text not null
);

create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  amount numeric not null check (amount >= 0),
  unit text not null,
  notes text,
  primary key (recipe_id, ingredient_id)
);

create table public.recipe_techniques (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  technique_id uuid not null references public.techniques (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (recipe_id, technique_id)
);

create table public.recipe_media (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  role text not null default 'cover' check (role in ('cover', 'step', 'thumb')),
  sort_order integer not null default 0,
  primary key (recipe_id, media_id)
);

create table public.user_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  amount numeric not null check (amount >= 0),
  unit text not null,
  expires_at date,
  created_at timestamptz not null default now(),
  unique (user_id, ingredient_id)
);

create table public.user_technique_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  technique_id uuid not null references public.techniques (id) on delete cascade,
  status text not null check (status in ('locked', 'unlocked', 'cleared')),
  cleared_at timestamptz,
  primary key (user_id, technique_id)
);

create table public.cooking_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete restrict,
  cooked_at timestamptz not null default now(),
  ingredients_used jsonb not null default '[]'::jsonb,
  adjusted_recipe jsonb,
  completed boolean not null default false,
  duration_seconds integer,
  techniques_used uuid[] not null default '{}'
);

create table public.recommendation_weights (
  key text primary key,
  value numeric not null,
  description text
);

create index user_ingredients_user_id_idx on public.user_ingredients (user_id);
create index user_technique_progress_user_id_idx on public.user_technique_progress (user_id);
create index cooking_history_user_id_cooked_at_idx on public.cooking_history (user_id, cooked_at desc);
create index recipe_techniques_technique_id_idx on public.recipe_techniques (technique_id);
create index recipe_ingredients_ingredient_id_idx on public.recipe_ingredients (ingredient_id);
create index techniques_stage_number_idx on public.techniques (stage_number);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  insert into public.user_technique_progress (user_id, technique_id, status)
  select
    new.id,
    t.id,
    case when t.stage_number = 1 then 'unlocked' else 'locked' end
  from public.techniques t;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.unlock_next_on_clear()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stage integer;
  next_id uuid;
begin
  if new.status = 'cleared' and old.status is distinct from 'cleared' then
    select stage_number into current_stage
    from public.techniques
    where id = new.technique_id;

    select id into next_id
    from public.techniques
    where stage_number = current_stage + 1;

    if next_id is not null then
      insert into public.user_technique_progress (user_id, technique_id, status)
      values (new.user_id, next_id, 'unlocked')
      on conflict (user_id, technique_id)
      do update set status = case
        when public.user_technique_progress.status = 'cleared' then 'cleared'
        else 'unlocked'
      end;
    end if;
  end if;
  return new;
end;
$$;

create trigger unlock_next_technique
after update on public.user_technique_progress
for each row execute function private.unlock_next_on_clear();

alter table public.profiles enable row level security;
alter table public.techniques enable row level security;
alter table public.media enable row level security;
alter table public.technique_steps enable row level security;
alter table public.technique_relations enable row level security;
alter table public.technique_media enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_steps enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_techniques enable row level security;
alter table public.recipe_media enable row level security;
alter table public.user_ingredients enable row level security;
alter table public.user_technique_progress enable row level security;
alter table public.cooking_history enable row level security;
alter table public.recommendation_weights enable row level security;

create policy "Catalog is readable"
on public.techniques for select
to anon, authenticated
using (true);

create policy "Media is readable"
on public.media for select
to anon, authenticated
using (true);

create policy "Technique steps are readable"
on public.technique_steps for select
to anon, authenticated
using (true);

create policy "Technique relations are readable"
on public.technique_relations for select
to anon, authenticated
using (true);

create policy "Technique media is readable"
on public.technique_media for select
to anon, authenticated
using (true);

create policy "Recipes are readable"
on public.recipes for select
to anon, authenticated
using (true);

create policy "Recipe steps are readable"
on public.recipe_steps for select
to anon, authenticated
using (true);

create policy "Ingredients are readable"
on public.ingredients for select
to anon, authenticated
using (true);

create policy "Recipe ingredients are readable"
on public.recipe_ingredients for select
to anon, authenticated
using (true);

create policy "Recipe techniques are readable"
on public.recipe_techniques for select
to anon, authenticated
using (true);

create policy "Recipe media is readable"
on public.recipe_media for select
to anon, authenticated
using (true);

create policy "Weights are readable"
on public.recommendation_weights for select
to anon, authenticated
using (true);

create policy "Users read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users read own ingredients"
on public.user_ingredients for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert own ingredients"
on public.user_ingredients for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users update own ingredients"
on public.user_ingredients for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users delete own ingredients"
on public.user_ingredients for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users read own progress"
on public.user_technique_progress for select
to authenticated
using (auth.uid() = user_id);

create policy "Users clear unlocked techniques"
on public.user_technique_progress for update
to authenticated
using (auth.uid() = user_id and status = 'unlocked')
with check (auth.uid() = user_id and status = 'cleared');

create policy "Users read own cooking history"
on public.cooking_history for select
to authenticated
using (auth.uid() = user_id);

create policy "Users insert own cooking history"
on public.cooking_history for insert
to authenticated
with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on
  public.techniques,
  public.media,
  public.technique_steps,
  public.technique_relations,
  public.technique_media,
  public.recipes,
  public.recipe_steps,
  public.ingredients,
  public.recipe_ingredients,
  public.recipe_techniques,
  public.recipe_media,
  public.recommendation_weights
to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_ingredients to authenticated;
grant select, update on public.user_technique_progress to authenticated;
grant select, insert on public.cooking_history to authenticated;
