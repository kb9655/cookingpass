import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecipeCard } from "../components/recipe/RecipeCard";
import { CardSkeleton, ErrorState, EmptyState } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { listParsedRecipes } from "../data/recipeRepository";
import { listScoredRecipes } from "../services/recipeService";
import { getTechniqueProgress } from "../services/techniqueService";
import { listUserIngredients } from "../services/ingredientService";
import { isSupabaseConfigured } from "../lib/supabase";
import type { ScoredRecipe } from "../types/recipe";

export function Recipes() {
  const { user, profile } = useAuth();
  const [params] = useSearchParams();
  const focusTechniqueId = params.get("technique");
  const [recipes, setRecipes] = useState<ScoredRecipe[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError("");

    const pantryTask = listUserIngredients();
    const progressTask =
      user && isSupabaseConfigured ? getTechniqueProgress(user.id) : Promise.resolve([]);

    Promise.all([
      listParsedRecipes(),
      pantryTask,
      progressTask,
    ])
      .then(([records, pantry, progress]) => {
        setCategories(
          [...new Set(records.map((record) => record.recipe.category).filter(Boolean))].sort(),
        );
        return listScoredRecipes({
          progress,
          pantry,
          experienceLevel: profile?.experience_level ?? "beginner",
          preferredMaxMinutes: profile?.preferred_max_minutes ?? null,
          availableTools: profile?.available_tools ?? [],
          focusTechniqueId,
          query,
          category,
        });
      })
      .then(setRecipes)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "레시피를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, focusTechniqueId, query, category]);

  const highlighted = useMemo(
    () => (focusTechniqueId ? recipes.filter((item) => item.relatedness === 1) : []),
    [recipes, focusTechniqueId],
  );

  return (
    <main className="page">
      <h1 className="text-3xl font-semibold tracking-tight">레시피</h1>
      <p className="mt-2 text-sm text-muted">
        데모 20종을 보유 재료와 추정 조리 기술로 정렬합니다. 재료를 등록하면 대체 검증에 쓰입니다.
      </p>

      <div className="mt-5 space-y-3">
        <div className="field">
          <label htmlFor="recipe-query">검색</label>
          <input
            id="recipe-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, 재료..."
          />
        </div>
        <div className="field">
          <label htmlFor="recipe-category">카테고리</label>
          <select
            id="recipe-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">전체</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : null}
      <div className="mt-6 grid gap-3">
        {loading ? (
          Array.from({ length: 4 }, (_, index) => <CardSkeleton key={index} />)
        ) : recipes.length === 0 ? (
          <EmptyState title="레시피가 없습니다" body="검색어나 카테고리를 바꿔 보세요." />
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
