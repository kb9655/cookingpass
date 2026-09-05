# cookingpass

조리 기술을 스테이지처럼 배우고, 보유 재료에 맞춰 레시피를 조정하는 학습 앱입니다.

지금은 레시피·재료를 `resource_temp` 로컬 CSV와 `localStorage`로 다룹니다. 기본 데이터는 원본에서 뽑은 데모 20종입니다.

## 로컬 실행

```bash
cp .env.example .env
npm install
npm run dev
```

Claude 레시피 조정은 `.env`의 `ANTHROPIC_API_KEY`가 필요합니다. Supabase 값은 로그인/기술 학습에만 쓰이며 Phase 3–5 데모에는 필수가 아닙니다.

데모 CSV를 다시 뽑으려면:

```bash
node scripts/sample-demo-recipes.mjs
```

원본은 `resource_temp/1_Recipe_csv.csv`, 앱이 읽는 파일은 `public/datasets/demo_recipes_20.csv`입니다. 다른 데이터셋은 `src/data/datasets.ts`에 추가하면 됩니다.

## 데이터베이스 (이후 이전용)

`supabase/migrations/` SQL을 Supabase 프로젝트에 적용하세요.

1. `001_initial_schema.sql`
2. `002_seed.sql`
