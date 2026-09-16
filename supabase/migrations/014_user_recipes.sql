-- Personal copies of adjusted recipes, with optional share codes (no public board).

create table if not exists public.user_recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_recipe_id uuid not null references public.recipes (id) on delete restrict,
  title text not null check (char_length(trim(title)) > 0 and char_length(title) <= 200),
  payload jsonb not null,
  share_code text unique,
  cloned_from uuid references public.user_recipes (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (owner_id, cloned_from)
);

create index if not exists user_recipes_owner_id_created_at_idx
  on public.user_recipes (owner_id, created_at desc);

alter table public.user_recipes enable row level security;

drop policy if exists "Users read own saved recipes" on public.user_recipes;
create policy "Users read own saved recipes"
on public.user_recipes for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Users insert own saved recipes" on public.user_recipes;
create policy "Users insert own saved recipes"
on public.user_recipes for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "Users update own saved recipes" on public.user_recipes;
create policy "Users update own saved recipes"
on public.user_recipes for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users delete own saved recipes" on public.user_recipes;
create policy "Users delete own saved recipes"
on public.user_recipes for delete
to authenticated
using (auth.uid() = owner_id);

grant select, insert, update, delete on public.user_recipes to authenticated;

create or replace function public.normalize_share_code(p_code text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  raw text;
  ch text;
  i int;
begin
  if p_code is null then
    return null;
  end if;

  raw := upper(regexp_replace(p_code, '[^0-9A-Za-z]', '', 'g'));
  raw := replace(raw, 'I', '1');
  raw := replace(raw, 'L', '1');
  raw := replace(raw, 'O', '0');
  raw := replace(raw, 'U', 'V');

  if char_length(raw) <> 8 then
    return null;
  end if;

  for i in 1..8 loop
    ch := substr(raw, i, 1);
    if position(ch in alphabet) = 0 then
      return null;
    end if;
  end loop;

  return substr(raw, 1, 4) || '-' || substr(raw, 5, 4);
end;
$$;

create or replace function public.generate_share_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea;
  result text := '';
  i int;
begin
  bytes := gen_random_bytes(8);
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return substr(result, 1, 4) || '-' || substr(result, 5, 4);
end;
$$;

create or replace function public.ensure_share_code(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing text;
  candidate text;
  attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select share_code into existing
  from public.user_recipes
  where id = p_id and owner_id = auth.uid();

  if not found then
    raise exception 'Recipe not found';
  end if;

  if existing is not null then
    return existing;
  end if;

  loop
    attempts := attempts + 1;
    if attempts > 8 then
      raise exception 'Could not allocate share code';
    end if;

    candidate := public.generate_share_code();
    begin
      update public.user_recipes
      set share_code = candidate
      where id = p_id
        and owner_id = auth.uid()
        and share_code is null
      returning share_code into existing;

      if existing is not null then
        return existing;
      end if;

      select share_code into existing
      from public.user_recipes
      where id = p_id and owner_id = auth.uid();

      if existing is not null then
        return existing;
      end if;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

create or replace function public.import_shared_recipe(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text;
  src public.user_recipes;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  normalized := public.normalize_share_code(p_code);
  if normalized is null then
    raise exception 'Invalid share code';
  end if;

  select * into src
  from public.user_recipes
  where share_code = normalized;

  if not found then
    raise exception 'Share code not found';
  end if;

  if src.owner_id = uid then
    raise exception 'Cannot import your own recipe';
  end if;

  select id into new_id
  from public.user_recipes
  where owner_id = uid and cloned_from = src.id;

  if found then
    return new_id;
  end if;

  insert into public.user_recipes (
    owner_id,
    source_recipe_id,
    title,
    payload,
    cloned_from
  )
  values (
    uid,
    src.source_recipe_id,
    src.title,
    src.payload,
    src.id
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.normalize_share_code(text) from public, anon;
revoke all on function public.generate_share_code() from public, anon;
revoke all on function public.ensure_share_code(uuid) from public, anon;
revoke all on function public.import_shared_recipe(text) from public, anon;

grant execute on function public.normalize_share_code(text) to authenticated;
grant execute on function public.generate_share_code() to authenticated;
grant execute on function public.ensure_share_code(uuid) to authenticated;
grant execute on function public.import_shared_recipe(text) to authenticated;
