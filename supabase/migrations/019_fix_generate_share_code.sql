-- pgcrypto lives in extensions on hosted Supabase; public search_path hid gen_random_bytes.

create or replace function public.generate_share_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea;
  result text := '';
  i int;
begin
  bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return substr(result, 1, 4) || '-' || substr(result, 5, 4);
end;
$$;

revoke all on function public.generate_share_code() from public, anon;
grant execute on function public.generate_share_code() to authenticated;
