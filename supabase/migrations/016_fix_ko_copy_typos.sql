-- Repair Korean copy from 015 (dictionary-form leftovers and drain phrasing).

update public.recipe_step_translations
set instruction = replace(instruction, '빼 뒤', '뺀 뒤')
where locale = 'ko';

update public.recipe_step_translations
set instruction = replace(instruction, '키친타월에 올려 기름을 빼다', '키친타월에 올려 기름을 뺀다')
where locale = 'ko';

update public.recipe_step_translations
set instruction = replace(instruction, '기름기를 뺀 뒤', '물을 버리고')
where locale = 'ko';

update public.recipe_step_translations as t
set instruction = '끓인 물을 감자가 잠길 때까지 붓는다. 10분간 둔다. 물을 버리고 감자를 키친타월 위에 옮긴다. 물기를 톡톡 두드려 뺀 뒤 최소 10분 이상 식힌다.'
from public.recipe_steps s
join public.recipes r on r.id = s.recipe_id
where t.step_id = s.id
  and t.locale = 'ko'
  and r.name = 'Air Fryer French Fries'
  and s.step_number = 3;

update public.recipe_step_translations as t
set instruction = '감자를 길이 방향으로 1/2인치 두께로 썬 다음, 다시 1/4인치 너비의 막대로 썬다. 찬물이 담긴 그릇에 넣고 약 5분간 담가 전분을 뺀 뒤 물을 버린다.'
from public.recipe_steps s
join public.recipes r on r.id = s.recipe_id
where t.step_id = s.id
  and t.locale = 'ko'
  and r.name = 'Air Fryer French Fries'
  and s.step_number = 2;

update public.recipe_step_translations as t
set instruction = '감자 껍질을 벗기고 1/2인치 두께로 썬다. 냄비에 넣고 물로 덮은 뒤 끓인다. 2분간 끓인 다음 물을 버리고 옆에 둔다.'
from public.recipe_steps s
join public.recipes r on r.id = s.recipe_id
where t.step_id = s.id
  and t.locale = 'ko'
  and r.name = 'Lyonnaise Potatoes'
  and s.step_number = 2;
