create table if not exists public.recipe_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  servings integer not null check (servings >= 1 and servings <= 16),
  notes text not null default '' check (char_length(notes) <= 500),
  visited_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists recipe_visits_user_visited_idx
  on public.recipe_visits (user_id, visited_at desc);

alter table public.recipe_visits enable row level security;

drop policy if exists "Users read own recipe visits" on public.recipe_visits;
create policy "Users read own recipe visits"
on public.recipe_visits for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own recipe visits" on public.recipe_visits;
create policy "Users insert own recipe visits"
on public.recipe_visits for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own recipe visits" on public.recipe_visits;
create policy "Users update own recipe visits"
on public.recipe_visits for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own recipe visits" on public.recipe_visits;
create policy "Users delete own recipe visits"
on public.recipe_visits for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.recipe_visits to authenticated;
