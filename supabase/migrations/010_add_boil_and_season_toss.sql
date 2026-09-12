-- Add boil and season-toss as beginner-visible techniques with photo rubrics.

insert into public.techniques (
  id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number, parent_id, capture_hint
) values
  (
    'a1111111-1111-4111-8111-111111111108',
    'boil',
    '끓이기',
    '물이나 육수를 끓여 재료가 잠긴 채로 익게 합니다.',
    1,
    8,
    array['재료가 잠길 만큼 물을 맞춘다', '끓는 흔적을 보고 가열이 되었는지 확인한다'],
    array['냄비'],
    array['김이 얼굴을 향하지 않게 합니다', '물이 넘치지 않게 불 조절을 합니다'],
    8,
    null,
    '냄비 안이 보이게 위에서 찍어 주세요. 정확한 온도는 맞출 필요가 없습니다.'
  ),
  (
    'a1111111-1111-4111-8111-111111111109',
    'season-toss',
    '양념 버무리기',
    '양념을 재료에 고르게 묻혀 섞습니다.',
    1,
    6,
    array['양념이 한쪽에만 몰리지 않게 섞는다', '재료가 으깨지지 않게 버무린다'],
    array['볼', '숟가락'],
    array['날재료를 만진 손은 다른 도구에 닿지 않게 합니다'],
    9,
    null,
    '버무린 재료가 한 그릇에 보이게 위에서 찍어 주세요.'
  )
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  description = excluded.description,
  difficulty = excluded.difficulty,
  estimated_minutes = excluded.estimated_minutes,
  learning_goals = excluded.learning_goals,
  required_tools = excluded.required_tools,
  precautions = excluded.precautions,
  stage_number = excluded.stage_number,
  parent_id = excluded.parent_id,
  capture_hint = excluded.capture_hint;

insert into public.technique_steps (technique_id, step_number, title, instruction, media_id) values
  ('a1111111-1111-4111-8111-111111111108', 1, '물 맞추기', '냄비에 재료가 잠길 만큼 물이나 육수를 붓습니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111108', 2, '끓이기', '중불에서 기포나 김이 보일 때까지 가열합니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111108', 3, '확인', '재료가 잠긴 채 넘치지 않는지 봅니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111109', 1, '양념 넣기', '볼에 재료와 양념을 넣습니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111109', 2, '버무리기', '숟가락으로 바닥부터 뒤집어 양념이 고르게 묻게 섞습니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111109', 3, '확인', '한쪽에만 양념이 몰렸는지 보고 더 섞습니다.', 'e5555555-5555-4555-8555-555555555001')
on conflict (technique_id, step_number) do update
set
  title = excluded.title,
  instruction = excluded.instruction,
  media_id = excluded.media_id;

insert into public.technique_criteria (technique_id, sort_order, name, check_hint, is_safety) values
  ('a1111111-1111-4111-8111-111111111108', 1, '재료가 잠김', '물이 재료를 대체로 덮고 있는지', false),
  ('a1111111-1111-4111-8111-111111111108', 2, '끓는 흔적', '김이나 기포가 보여 가열이 이뤄졌는지. 정확한 온도는 평가하지 않음', false),
  ('a1111111-1111-4111-8111-111111111108', 3, '안전한 냄비 상태', '넘치거나 손잡이, 김이 얼굴을 향하지 않는지', true),
  ('a1111111-1111-4111-8111-111111111109', 1, '고르게 묻음', '한쪽에만 양념이 몰리지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111109', 2, '재료 형태', '세게 섞어 으깨진 조각이 많지 않은지', false),
  ('a1111111-1111-4111-8111-111111111109', 3, '양념 농도', '국물만 고이거나 겉만 마른 상태가 아닌지', false)
on conflict (technique_id, sort_order) do update
set
  name = excluded.name,
  check_hint = excluded.check_hint,
  is_safety = excluded.is_safety;

insert into public.technique_relations (technique_id, related_technique_id) values
  ('a1111111-1111-4111-8111-111111111108', 'a1111111-1111-4111-8111-111111111105'),
  ('a1111111-1111-4111-8111-111111111105', 'a1111111-1111-4111-8111-111111111108'),
  ('a1111111-1111-4111-8111-111111111109', 'a1111111-1111-4111-8111-111111111104'),
  ('a1111111-1111-4111-8111-111111111104', 'a1111111-1111-4111-8111-111111111109'),
  ('a1111111-1111-4111-8111-111111111109', 'a1111111-1111-4111-8111-111111111107'),
  ('a1111111-1111-4111-8111-111111111107', 'a1111111-1111-4111-8111-111111111109')
on conflict do nothing;

insert into public.user_technique_progress (user_id, technique_id, status)
select p.id, t.id, 'unlocked'
from public.profiles p
cross join (
  values
    ('a1111111-1111-4111-8111-111111111108'::uuid),
    ('a1111111-1111-4111-8111-111111111109'::uuid)
) as t(id)
on conflict (user_id, technique_id) do nothing;
