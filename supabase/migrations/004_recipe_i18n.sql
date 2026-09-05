-- Bilingual recipe catalog + preferred locale on profiles.

alter table public.recipes
  add column if not exists category text not null default '',
  add column if not exists subcategory text not null default '';

alter table public.profiles
  add column if not exists preferred_locale text not null default 'ko';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_preferred_locale_check'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_locale_check
      check (preferred_locale in ('en', 'ko'));
  end if;
end;
$$;

create table if not exists public.recipe_translations (
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  locale text not null check (locale in ('en', 'ko')),
  name text not null,
  description text not null,
  category text not null default '',
  subcategory text not null default '',
  primary key (recipe_id, locale)
);

create table if not exists public.recipe_step_translations (
  step_id uuid not null references public.recipe_steps (id) on delete cascade,
  locale text not null check (locale in ('en', 'ko')),
  instruction text not null,
  primary key (step_id, locale)
);

create table if not exists public.ingredient_translations (
  ingredient_id uuid not null references public.ingredients (id) on delete cascade,
  locale text not null check (locale in ('en', 'ko')),
  name text not null,
  primary key (ingredient_id, locale)
);

create index if not exists recipe_translations_locale_idx
  on public.recipe_translations (locale);

create index if not exists recipe_step_translations_locale_idx
  on public.recipe_step_translations (locale);

create index if not exists ingredient_translations_locale_idx
  on public.ingredient_translations (locale);

alter table public.recipe_translations enable row level security;
alter table public.recipe_step_translations enable row level security;
alter table public.ingredient_translations enable row level security;

drop policy if exists "Recipe translations are readable" on public.recipe_translations;
create policy "Recipe translations are readable"
on public.recipe_translations for select
to anon, authenticated
using (true);

drop policy if exists "Recipe step translations are readable" on public.recipe_step_translations;
create policy "Recipe step translations are readable"
on public.recipe_step_translations for select
to anon, authenticated
using (true);

drop policy if exists "Ingredient translations are readable" on public.ingredient_translations;
create policy "Ingredient translations are readable"
on public.ingredient_translations for select
to anon, authenticated
using (true);

grant select on
  public.recipe_translations,
  public.recipe_step_translations,
  public.ingredient_translations
to anon, authenticated;
