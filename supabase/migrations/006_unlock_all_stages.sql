-- Open every technique immediately. Completion is recorded as cleared only.

update public.user_technique_progress
set status = 'unlocked'
where status = 'locked';

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display text;
begin
  display := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, name, display_name)
  values (new.id, display, display)
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        name = coalesce(nullif(public.profiles.name, ''), excluded.name);

  insert into public.user_technique_progress (user_id, technique_id, status)
  select
    new.id,
    t.id,
    'unlocked'
  from public.techniques t
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists unlock_next_technique on public.user_technique_progress;
drop function if exists private.unlock_next_on_clear();

drop policy if exists "Users clear unlocked techniques" on public.user_technique_progress;
create policy "Users clear unlocked techniques"
on public.user_technique_progress for update
to authenticated
using (auth.uid() = user_id and status is distinct from 'cleared')
with check (auth.uid() = user_id and status = 'cleared');

drop policy if exists "Users insert own progress" on public.user_technique_progress;
create policy "Users insert own progress"
on public.user_technique_progress for insert
to authenticated
with check (auth.uid() = user_id);

grant select, insert, update on public.user_technique_progress to authenticated;
