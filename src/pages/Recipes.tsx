import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecipeCard } from "../components/recipe/RecipeCard";
import { CardSkeleton, ErrorState, EmptyState } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import { listScoredRecipes, listRecipes } from "../services/recipeService";
import { getTechniqueProgress } from "../services/techniqueService";
import { listUserIngredients } from "../services/ingredientService";
import type { ScoredRecipe } from "../types/recipe";

export function Recipes() {
  const { user, profile } = useAuth();
  const [params] = useSearchParams();
  const focusTechniqueId = params.get("technique");
  const [recipes, setRecipes] = useState<ScoredRecipe[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);

  function load() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");

    const task = user
      ? Promise.all([
          getTechniqueProgress(user.id),
          listUserIngredients(user.id),
        ]).then(([progress, pantry]) =>
          listScoredRecipes({
            progress,
            pantry,
            experienceLevel: profile?.experience_level ?? "beginner",
            preferredMaxMinutes: profile?.preferred_max_minutes ?? null,
            availableTools: profile?.available_tools ?? [],
            focusTechniqueId,
          }),
        )
      : listRecipes().then((items) =>
          items.map((item) => ({
            ...item,
            score: 0,
            skill_match: 0,
            pantry_coverage: 0,
            difficulty_fit: 0,
            time_fit: 0,
            tool_fit: 0,
            relatedness: 0,
          })),
        );

    task
      .then(setRecipes)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "레시피를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, focusTechniqueId]);

  const highlighted = useMemo(
    () => (focusTechniqueId ? recipes.filter((item) => item.relatedness === 1) : []),
    [recipes, focusTechniqueId],
  );

  return (
    <main className="page">
      <h1 className="text-3xl font-semibold tracking-tight">레시피</h1>
      <p className="mt-2 text-sm text-muted">
        {user
          ? "클리어한 기술과 보유 재료를 기준으로 정렬합니다."
          : "로그인하면 보유 재료와 학습 기록에 맞춰 추천합니다."}
      </p>
      {error ? (
        <div className="mt-6">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : null}
      <div className="mt-6 grid gap-3">
        {!isSupabaseConfigured ? (
          <EmptyState
            title="데이터베이스가 연결되지 않았습니다"
            body=".env에 Supabase 값을 넣으면 추천 레시피가 나타납니다."
          />
        ) : loading ? (
          Array.from({ length: 4 }, (_, index) => <CardSkeleton key={index} />)
        ) : recipes.length === 0 ? (
          <EmptyState title="레시피가 없습니다" body="시드 데이터를 적용한 뒤 다시 열어 주세요." />
        ) : (
          recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              highlight={highlighted.some((item) => item.id === recipe.id)}
            />
          ))
        )}
      </div>
    </main>
  );
}
