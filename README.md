# cookingpass

조리 기술을 스테이지처럼 배우고, 보유 재료에 맞춰 레시피를 조정하는 학습 앱입니다.

## 로컬 실행

```bash
cp .env.example .env
npm install
npm run dev
```

`.env`에는 브라우저용 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`만 넣습니다. `ANTHROPIC_API_KEY`와 `R2_*`는 Netlify Functions(서버)에서만 사용합니다.

## 데이터베이스

`supabase/migrations/` SQL을 Supabase 프로젝트에 적용하세요.

1. `001_initial_schema.sql`
2. `002_seed.sql`
