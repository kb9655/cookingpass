-- Independent measure axes, backfilled from preferred_units.

alter table public.profiles
  add column if not exists preferred_mass text not null default 'ko';

alter table public.profiles
  add column if not exists preferred_volume text not null default 'ko';

alter table public.profiles
  add column if not exists preferred_length text not null default 'ko';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_preferred_mass_check') then
    alter table public.profiles
      add constraint profiles_preferred_mass_check
      check (preferred_mass in ('ko', 'us'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_preferred_volume_check') then
    alter table public.profiles
      add constraint profiles_preferred_volume_check
      check (preferred_volume in ('ko', 'us'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_preferred_length_check') then
    alter table public.profiles
      add constraint profiles_preferred_length_check
      check (preferred_length in ('ko', 'us'));
  end if;
end;
$$;

update public.profiles
set
  preferred_mass = preferred_units,
  preferred_volume = preferred_units,
  preferred_length = preferred_units
where preferred_units in ('ko', 'us');
