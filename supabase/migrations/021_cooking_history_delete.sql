drop policy if exists "Users delete own cooking history" on public.cooking_history;
create policy "Users delete own cooking history"
on public.cooking_history for delete
to authenticated
using (auth.uid() = user_id);

grant delete on public.cooking_history to authenticated;
