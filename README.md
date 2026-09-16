# cookingpass

조리 기술을 스테이지처럼 배우고, 보유 재료에 맞춰 레시피를 조정하는 학습 앱입니다.

지금은 레시피·재료를 `resource_temp` 로컬 CSV와 `localStorage`로 다룹니다. 기본 데이터는 원본에서 뽑은 데모 20종입니다.

## 로컬 실행

```bash
cp .env.example .env
npm install
npm run dev
```

`npm run dev`는 프런트엔드만 실행합니다. Vercel Functions까지 함께 시험하려면 연결된 프로젝트에서 `npx vercel dev`를 사용하세요.

Claude 레시피 조정과 긴급도움 챗봇은 `.env` 또는 Vercel 환경 변수의 `ANTHROPIC_API_KEY`가 필요합니다.

## Google 로그인 설정

소셜 로그인 세션과 사용자 데이터는 기존 Supabase Auth를 사용하고, 앱과 인증 복귀 화면은 Vercel에서 제공합니다.

1. Supabase Dashboard의 **Authentication → Providers**에서 Google을 활성화하고 Google Cloud에서 발급한 Client ID/Secret을 입력합니다.
2. Google Cloud의 Authorized redirect URI에는 Supabase Dashboard에 표시되는 아래 callback을 등록합니다.

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

3. Supabase **Authentication → URL Configuration**의 Site URL은 실제 Vercel 운영 도메인으로 지정하고 Redirect Allow List에 다음을 추가합니다.

```text
http://localhost:5173/auth/callback
https://<PRODUCTION_DOMAIN>/auth/callback
https://*-<VERCEL_TEAM_SLUG>.vercel.app/**
```

4. Vercel Project Environment Variables에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 설정합니다. Supabase service-role key와 Google secret은 `VITE_` 변수나 저장소에 넣지 않습니다.

## 긴급도움 챗봇 설정

`/api/chat`은 Supabase access token이 있는 사용자만 호출할 수 있으며, 대화는 DB에 저장하지 않습니다. Anthropic API의 Claude를 직접 호출해 응답을 스트리밍합니다.

Vercel Project Environment Variables에 다음 값을 설정합니다.

```text
ANTHROPIC_API_KEY=<Anthropic API key>
ANTHROPIC_CHAT_MODEL=claude-haiku-4-5
```

`ANTHROPIC_CHAT_MODEL`은 선택 사항이며 기본값은 `claude-haiku-4-5`입니다. 프로그래밍, 역할극 등 조리와 관계없는 요청은 서버에서 차단하고 Claude에도 조리 문제 해결 전용 지침을 적용합니다.

운영 자격 증명 없이도 UI와 빌드는 확인할 수 있지만, Google 실제 로그인과 챗 응답 검증에는 위 Dashboard 설정이 필요합니다.

데모 CSV를 다시 뽑으려면:

```bash
node scripts/sample-demo-recipes.mjs
```

원본은 `resource_temp/1_Recipe_csv.csv`, 앱이 읽는 파일은 `public/datasets/demo_recipes_20.csv`입니다. 다른 데이터셋은 `src/data/datasets.ts`에 추가하면 됩니다.

## 데이터베이스 (이후 이전용)

`supabase/migrations/` SQL을 Supabase 프로젝트에 적용하세요.

1. `001_initial_schema.sql`
2. `002_seed.sql`
