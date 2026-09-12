-- Test leaf technique for the explain → upload → evaluate wizard.

insert into public.techniques (
  id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number, parent_id, capture_hint
) values (
  'a1111111-1111-4111-8111-111111111199',
  'practice-eval-test',
  '테스트 학습',
  '사진 평가 흐름을 확인하기 위한 연습입니다. 접시에 올린 뒤 위에서 찍으면 됩니다.',
  1,
  3,
  array['접시 가운데에 재료를 올린다', '접시 전체가 보이게 찍는다'],
  array['접시'],
  array['칼이나 뜨거운 팬이 사진에 위험하게 나오지 않게 합니다'],
  99,
  null,
  '접시 전체가 보이게 위에서 찍어 주세요.'
)
on conflict (id) do nothing;

insert into public.technique_steps (technique_id, step_number, title, instruction) values
  ('a1111111-1111-4111-8111-111111111199', 1, '접시에 올리기', '연습할 재료나 물건을 접시 가운데에 올립니다.'),
  ('a1111111-1111-4111-8111-111111111199', 2, '위에서 찍기', '접시 전체가 보이도록 위에서 사진을 찍습니다.')
on conflict (technique_id, step_number) do nothing;

insert into public.technique_criteria (technique_id, sort_order, name, check_hint, is_safety) values
  ('a1111111-1111-4111-8111-111111111199', 1, '접시에 올리기', '재료나 물건이 접시 위에 있는지', false),
  ('a1111111-1111-4111-8111-111111111199', 2, '가운데 배치', '한쪽으로 지나치게 치우치지 않았는지', false),
  ('a1111111-1111-4111-8111-111111111199', 3, '안전한 촬영', '칼날이나 뜨거운 조리가구가 위험하게 보이지 않는지', true)
on conflict (technique_id, sort_order) do nothing;

insert into public.technique_relations (technique_id, related_technique_id) values
  ('a1111111-1111-4111-8111-111111111199', 'a1111111-1111-4111-8111-111111111101')
on conflict do nothing;

insert into public.user_technique_progress (user_id, technique_id, status)
select p.id, 'a1111111-1111-4111-8111-111111111199', 'unlocked'
from public.profiles p
on conflict do nothing;
