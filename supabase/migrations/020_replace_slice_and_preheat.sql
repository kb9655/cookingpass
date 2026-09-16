-- Replace 썰기 with 나박썰기 and 팬 예열하기 with 삶기, with matching lesson steps and photo rubrics.

update public.techniques
set
  slug = 'nabak-cut',
  name = '나박썰기',
  description = '재료를 얇은 편으로 썬 뒤 사방 2~3cm 정사각형으로 썹니다.',
  difficulty = 2,
  estimated_minutes = 8,
  learning_goals = array['편의 두께를 비슷하게 맞춘다', '가로세로가 비슷한 사각 모양으로 썬다'],
  required_tools = array['칼', '도마'],
  precautions = array['둥근 재료는 먼저 한쪽을 잘라 바닥을 만듭니다', '손가락 끝을 안으로 말아 칼날과 거리를 둡니다'],
  target_size = '가로세로 2~3cm, 두께 0.3cm 정도',
  capture_hint = '썬 조각을 도마에 겹치지 않게 펼쳐 위에서 찍어 주세요. 자로 잰 듯 정확할 필요는 없습니다.'
where id = 'a1111111-1111-4111-8111-111111111105';

update public.techniques
set
  slug = 'parboil',
  name = '삶기',
  description = '끓는 물에 재료를 넣어 속까지 익힌 뒤 건져 냅니다.',
  difficulty = 1,
  estimated_minutes = 10,
  learning_goals = array['재료가 잠길 만큼 물을 넉넉히 끓인다', '익은 재료를 건져 물기를 뺀다'],
  required_tools = array['냄비', '체'],
  precautions = array['재료를 넣을 때 끓는 물이 튀지 않게 천천히 넣습니다', '건질 때는 체나 집게를 써서 김에 손이 데지 않게 합니다'],
  target_size = null,
  capture_hint = '삶아서 건진 재료가 보이게 접시나 체 위에서 찍어 주세요. 정확한 시간을 맞출 필요는 없습니다.'
where id = 'a1111111-1111-4111-8111-111111111106';

delete from public.technique_steps
where technique_id in (
  'a1111111-1111-4111-8111-111111111105',
  'a1111111-1111-4111-8111-111111111106'
);

insert into public.technique_steps (technique_id, step_number, title, instruction, media_id) values
  ('a1111111-1111-4111-8111-111111111105', 1, '바닥 만들기', '둥근 재료는 한쪽을 먼저 잘라 도마에 닿는 평평한 면을 만듭니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111105', 2, '편 썰기', '재료를 눕혀 0.3cm 정도의 얇은 편으로 썹니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111105', 3, '사각으로 썰기', '편을 겹쳐 놓고 가로세로 2~3cm가 되게 썰어 네모난 조각을 만듭니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111106', 1, '물 끓이기', '냄비에 재료가 충분히 잠길 만큼 물을 붓고 끓입니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111106', 2, '재료 넣고 삶기', '물이 끓으면 재료를 천천히 넣고 속까지 익을 때까지 삶습니다.', 'e5555555-5555-4555-8555-555555555001'),
  ('a1111111-1111-4111-8111-111111111106', 3, '건지기', '익으면 체나 집게로 건져 물기를 뺍니다.', 'e5555555-5555-4555-8555-555555555001');

insert into public.technique_criteria (technique_id, sort_order, name, check_hint, is_safety) values
  ('a1111111-1111-4111-8111-111111111105', 1, '사각 형태', '조각이 대체로 네모난 편인지. 길쭉한 채나 둥근 조각만 많지 않은지', false),
  ('a1111111-1111-4111-8111-111111111105', 2, '두께 균일성', '조각마다 두께 차이가 지나치게 크지 않은지. 정확한 mm는 평가하지 않음', false),
  ('a1111111-1111-4111-8111-111111111105', 3, '크기 균일성', '가로세로가 비슷하고 유난히 크거나 작은 조각이 많지 않은지', false),
  ('a1111111-1111-4111-8111-111111111106', 1, '익힘 정도', '속까지 익은 모습인지. 덜 익은 부분이 크게 남아 있지 않은지. 정확한 시간은 평가하지 않음', false),
  ('a1111111-1111-4111-8111-111111111106', 2, '재료 형태', '너무 오래 삶아 부서지거나 뭉개진 조각이 많지 않은지', false),
  ('a1111111-1111-4111-8111-111111111106', 3, '안전한 상태', '냄비가 넘치거나 손이 끓는 물, 김에 가까이 있는 모습이 보이지 않는지. 사진에서 확인할 수 없으면 문제없는 것으로 봅니다', true)
on conflict (technique_id, sort_order) do update
set
  name = excluded.name,
  check_hint = excluded.check_hint,
  is_safety = excluded.is_safety;

-- 팬 예열하기와 볶기를 잇던 관계를 삶기 기준으로 바꿉니다.
delete from public.technique_relations
where technique_id = 'a1111111-1111-4111-8111-111111111106'
   or related_technique_id = 'a1111111-1111-4111-8111-111111111106';

insert into public.technique_relations (technique_id, related_technique_id) values
  ('a1111111-1111-4111-8111-111111111106', 'a1111111-1111-4111-8111-111111111108'),
  ('a1111111-1111-4111-8111-111111111108', 'a1111111-1111-4111-8111-111111111106'),
  ('a1111111-1111-4111-8111-111111111106', 'a1111111-1111-4111-8111-111111111109'),
  ('a1111111-1111-4111-8111-111111111109', 'a1111111-1111-4111-8111-111111111106')
on conflict do nothing;

-- 예열 키워드로 붙었던 레시피 연결을 지우고, 물에 삶는 조리가 나오는 레시피에 다시 붙입니다.
delete from public.recipe_techniques
where technique_id = 'a1111111-1111-4111-8111-111111111106';

insert into public.recipe_techniques (recipe_id, technique_id, is_primary)
select distinct s.recipe_id, 'a1111111-1111-4111-8111-111111111106'::uuid, false
from public.recipe_steps s
where s.instruction ~* '(parboil|blanch|hard.?boil|boiling water|boil until|pot of [a-z ]*water|cover(ed)? with water)'
on conflict (recipe_id, technique_id) do nothing;

-- 내용이 바뀐 두 학습은 다시 연습하도록 진행도를 되돌립니다.
update public.user_technique_progress
set status = 'unlocked', cleared_at = null, last_item_scores = null
where technique_id in (
  'a1111111-1111-4111-8111-111111111105',
  'a1111111-1111-4111-8111-111111111106'
);
