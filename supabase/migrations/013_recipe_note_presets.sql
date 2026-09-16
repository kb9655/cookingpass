-- Saved recipe adjustment notes per account, shown as extra chips.

create table if not exists public.recipe_note_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(trim(label)) > 0 and char_length(label) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, label)
);

alter table public.recipe_note_presets enable row level security;

drop policy if exists "Users read own note presets" on public.recipe_note_presets;
create policy "Users read own note presets"
on public.recipe_note_presets for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own note presets" on public.recipe_note_presets;
create policy "Users insert own note presets"
on public.recipe_note_presets for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users update own note presets" on public.recipe_note_presets;
create policy "Users update own note presets"
on public.recipe_note_presets for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users delete own note presets" on public.recipe_note_presets;
create policy "Users delete own note presets"
on public.recipe_note_presets for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.recipe_note_presets to authenticated;
