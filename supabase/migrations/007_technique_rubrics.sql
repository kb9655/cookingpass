-- Rubrics for photo evaluation, stir-fry variants, and last scores for stars.

alter table public.techniques
  add column if not exists parent_id uuid references public.techniques (id) on delete cascade,
  add column if not exists target_size text,
  add column if not exists capture_hint text;

alter table public.user_technique_progress
  add column if not exists last_item_scores smallint[];

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_technique_progress_last_item_scores_len'
  ) then
    alter table public.user_technique_progress
      add constraint user_technique_progress_last_item_scores_len
      check (
        last_item_scores is null
        or (
          array_length(last_item_scores, 1) = 3
          and last_item_scores[1] between 1 and 3
          and last_item_scores[2] between 1 and 3
          and last_item_scores[3] between 1 and 3
        )
      );
  end if;
end;
$$;

create table if not exists public.technique_criteria (
  id uuid primary key default gen_random_uuid(),
  technique_id uuid not null references public.techniques (id) on delete cascade,
  sort_order smallint not null check (sort_order between 1 and 3),
  name text not null,
  check_hint text not null,
  is_safety boolean not null default false,
  unique (technique_id, sort_order)
);

create table if not exists public.user_technique_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  technique_id uuid not null references public.techniques (id) on delete cascade,
  item_scores jsonb not null,
  passed boolean not null,
  headline text not null,
  next_practice text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_technique_attempts_user_id_created_at_idx
  on public.user_technique_attempts (user_id, created_at desc);
create index if not exists technique_criteria_technique_id_idx
  on public.technique_criteria (technique_id);

alter table public.technique_criteria enable row level security;
alter table public.user_technique_attempts enable row level security;

drop policy if exists "Criteria are readable" on public.technique_criteria;
create policy "Criteria are readable"
on public.technique_criteria for select
to anon, authenticated
using (true);

drop policy if exists "Users read own attempts" on public.user_technique_attempts;
create policy "Users read own attempts"
on public.user_technique_attempts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users insert own attempts" on public.user_technique_attempts;
create policy "Users insert own attempts"
on public.user_technique_attempts for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users clear unlocked techniques" on public.user_technique_progress;
drop policy if exists "Users update own progress" on public.user_technique_progress;
create policy "Users update own progress"
on public.user_technique_progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id and status in ('unlocked', 'cleared'));

grant select on public.technique_criteria to anon, authenticated;
grant select, insert on public.user_technique_attempts to authenticated;

update public.techniques
set target_size = '쌀알에서 콩알 크기 정도'
where slug = 'mince';

update public.techniques
set capture_hint = '팬을 1~2분 예열한 뒤 사진을 찍어 주세요. 물 한 방울이 구르듯 움직이면 참고만 하세요. 정확한 온도를 맞출 필요는 없습니다.'
where slug = 'preheat-pan';

insert into public.techniques (
  id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number, parent_id
) values
  (
    'a1111111-1111-4111-8111-111111111171',
    'stir-fry-onion',
    '양파 볶기',
    '얇게 썬 양파를 고르게 볶아 단맛과 투명한 색을 냅니다.',
    2, 8,
    array['양파가 고르게 익게 섞는다', '너무 타지 않게 색을 본다'],
    array['프라이팬', '주걱'],
    array['강불에서 오래 두면 겉만 탑니다'],
    71,
    'a1111111-1111-4111-8111-111111111107'
  ),
  (
    'a1111111-1111-4111-8111-111111111172',
    'stir-fry-carrot',
    '당근 볶기',
    '채 썬 당근을 고르게 볶아 숨이 죽되 형태는 남깁니다.',
    2, 8,
    array['당근이 고르게 익게 섞는다', '너무 물러지지 않게 본다'],
    array['프라이팬', '주걱'],
    array['수분이 많으면 팬이 식으니 양을 나눠 볶습니다'],
    72,
    'a1111111-1111-4111-8111-111111111107'
  ),
  (
    'a1111111-1111-4111-8111-111111111173',
    'stir-fry-cabbage',
    '양배추 볶기',
    '양배추를 볶아 숨이 죽되 아삭함이 남게 합니다.',
    2, 8,
    array['양배추가 고르게 익게 섞는다', '물기가 고이지 않게 본다'],
    array['프라이팬', '주걱'],
    array['한꺼번에 많이 넣으면 찐 것처럼 됩니다'],
    73,
    'a1111111-1111-4111-8111-111111111107'
  ),
  (
    'a1111111-1111-4111-8111-111111111174',
    'stir-fry-mixed',
    '야채 볶음',
    '여러 채소를 순서대로 넣어 고르게 볶습니다.',
    3, 12,
    array['익는 시간이 다른 채소를 순서대로 넣는다', '한쪽에만 타지 않게 섞는다'],
    array['프라이팬', '주걱'],
    array['수분이 많은 재료는 나중에 넣습니다'],
    74,
    'a1111111-1111-4111-8111-111111111107'
  )
on conflict (id) do nothing;

insert into public.technique_steps (technique_id, step_number, title, instruction) values
  ('a1111111-1111-4111-8111-111111111171', 1, '팬 준비', '예열한 팬에 기름을 두르고 양파를 펼쳐 넣습니다.'),
  ('a1111111-1111-4111-8111-111111111171', 2, '고르게 볶기', '주걱으로 바닥부터 뒤집어 양파가 한곳에 머물지 않게 볶습니다.'),
  ('a1111111-1111-4111-8111-111111111172', 1, '팬 준비', '예열한 팬에 기름을 두르고 당근을 펼쳐 넣습니다.'),
  ('a1111111-1111-4111-8111-111111111172', 2, '고르게 볶기', '주걱으로 바닥부터 뒤집어 당근이 고르게 익게 볶습니다.'),
  ('a1111111-1111-4111-8111-111111111173', 1, '팬 준비', '예열한 팬에 기름을 두르고 양배추를 펼쳐 넣습니다.'),
  ('a1111111-1111-4111-8111-111111111173', 2, '고르게 볶기', '숨이 죽되 형태가 남도록 빠르게 섞어 볶습니다.'),
  ('a1111111-1111-4111-8111-111111111174', 1, '순서대로 넣기', '익는 시간이 긴 재료부터 넣고 부드러운 채소는 나중에 넣습니다.'),
  ('a1111111-1111-4111-8111-111111111174', 2, '빠르게 섞기', '주걱으로 바닥부터 뒤집어 재료가 한곳에 머물지 않게 볶습니다.');

insert into public.user_technique_progress (user_id, technique_id, status)
select p.id, t.id, 'unlocked'
from public.profiles p
cross join public.techniques t
where t.parent_id is not null
on conflict do nothing;

insert into public.technique_criteria (technique_id, sort_order, name, check_hint, is_safety) values
  ('a1111111-1111-4111-8111-111111111101', 1, '안정적으로 잡기', '칼이 손에서 흔들리지 않고 편안하게 잡혀 있는지', false),
  ('a1111111-1111-4111-8111-111111111101', 2, '자연스러운 손 자세', '손가락에 과도하게 힘을 주거나 불편하게 꺾지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111101', 3, '안전한 재료 잡기', '손가락 끝이 칼날 쪽으로 펴져 있지 않고 안쪽으로 살짝 말려 있는지', true),

  ('a1111111-1111-4111-8111-111111111102', 1, '껍질 제거 정도', '껍질이 큰 부분으로 남아 있지 않은지', false),
  ('a1111111-1111-4111-8111-111111111102', 2, '과육 손실', '껍질과 함께 과육이 지나치게 제거되지 않은지', false),
  ('a1111111-1111-4111-8111-111111111102', 3, '비교적 일정하게 제거', '특정 부분만 지나치게 두껍거나 얇게 벗겨지지 않은지', false),

  ('a1111111-1111-4111-8111-111111111103', 1, '채 형태', '길고 가느다란 형태의 기본을 갖추었는지', false),
  ('a1111111-1111-4111-8111-111111111103', 2, '두께 균일성', '크기가 지나치게 제각각인 조각이 많지 않은지', false),
  ('a1111111-1111-4111-8111-111111111103', 3, '크기 균일성', '너무 크거나 작은 조각이 일부 섞여 있지는 않은지', false),

  ('a1111111-1111-4111-8111-111111111104', 1, '충분히 잘게 자르기', '큰 덩어리가 많이 남아 있지 않은지', false),
  ('a1111111-1111-4111-8111-111111111104', 2, '조각 크기 균일성', '지나치게 큰 조각과 작은 조각의 차이가 크지 않은지', false),
  ('a1111111-1111-4111-8111-111111111104', 3, '전체적인 균일성', '한쪽에 큰 덩어리가 몰려 있지 않은지', false),

  ('a1111111-1111-4111-8111-111111111105', 1, '원하는 형태', '재료가 지나치게 찌그러지거나 깨지지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111105', 2, '두께 균일성', '조각마다 두께 차이가 지나치게 크지 않은지', false),
  ('a1111111-1111-4111-8111-111111111105', 3, '깔끔한 절단', '뭉개지거나 불필요하게 찢어진 조각이 많지 않은지', false),

  ('a1111111-1111-4111-8111-111111111106', 1, '충분히 예열', '재료를 넣기 전에 팬을 예열하는 과정을 수행했는지. 정확한 온도는 평가하지 않음', false),
  ('a1111111-1111-4111-8111-111111111106', 2, '고르게 가열', '팬을 한쪽만 과도하게 가열하지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111106', 3, '조리 준비 상태', '팬이 준비된 상태에서 재료를 넣을 수 있는 상황인지', false),

  ('a1111111-1111-4111-8111-111111111171', 1, '고르게 익음', '양파 일부는 너무 덜 익고 일부는 지나치게 익은 모습이 아닌지', false),
  ('a1111111-1111-4111-8111-111111111171', 2, '색과 겉모습', '양파가 지나치게 타거나 색이 지나치게 변하지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111171', 3, '재료 형태 유지', '양파가 지나치게 물러지거나 으깨진 조각이 많지 않은지', false),

  ('a1111111-1111-4111-8111-111111111172', 1, '고르게 익음', '당근 일부는 너무 덜 익고 일부는 지나치게 익은 모습이 아닌지', false),
  ('a1111111-1111-4111-8111-111111111172', 2, '색과 겉모습', '당근이 지나치게 타거나 색이 지나치게 변하지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111172', 3, '재료 형태 유지', '당근이 지나치게 물러지거나 으깨진 조각이 많지 않은지', false),

  ('a1111111-1111-4111-8111-111111111173', 1, '고르게 익음', '양배추 일부는 너무 덜 익고 일부는 지나치게 익은 모습이 아닌지', false),
  ('a1111111-1111-4111-8111-111111111173', 2, '색과 겉모습', '양배추가 지나치게 타거나 색이 지나치게 변하지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111173', 3, '재료 형태 유지', '양배추가 지나치게 물러지거나 으깨진 조각이 많지 않은지', false),

  ('a1111111-1111-4111-8111-111111111174', 1, '고르게 익음', '여러 채소가 한쪽만 덜 익거나 한쪽만 타지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111174', 2, '색과 겉모습', '전체적으로 지나치게 타거나 색이 지나치게 변하지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111174', 3, '재료 형태 유지', '채소가 지나치게 물러지거나 으깨진 조각이 많지 않은지', false)
on conflict (technique_id, sort_order) do nothing;
