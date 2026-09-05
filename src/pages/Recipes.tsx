import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecipeCard } from "../components/recipe/RecipeCard";
import { CardSkeleton, ErrorState, EmptyState } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { listRecipeCategories, listScoredRecipes } from "../services/recipeService";
import { getTechniqueProgress } from "../services/techniqueService";
import { listUserIngredients } from "../services/ingredientService";
import { isSupabaseConfigured } from "../lib/supabase";
import type { ScoredRecipe } from "../types/recipe";

export function Recipes() {
  const { user, profile } = useAuth();
  const { locale, t } = useLocale();
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

    const pantryTask = listUserIngredients(locale);
    const progressTask =
      user && isSupabaseConfigured ? getTechniqueProgress(user.id) : Promise.resolve([]);

    Promise.all([listRecipeCategories(locale), pantryTask, progressTask])
      .then(([nextCategories, pantry, progress]) => {
        setCategories(nextCategories);
        return listScoredRecipes({
          locale,
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
        setError(err instanceof Error ? err.message : t("recipesLoadError"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, focusTechniqueId, query, category, locale]);

  const highlighted = useMemo(
    () => (focusTechniqueId ? recipes.filter((item) => item.relatedness === 1) : []),
    [recipes, focusTechniqueId],
  );

  return (
    <main className="page">
      <h1 className="text-3xl font-semibold tracking-tight">{t("recipesTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("recipesLead")}</p>

      <div className="mt-5 space-y-3">
        <div className="field">
          <label htmlFor="recipe-query">{t("recipesSearch")}</label>
          <input
            id="recipe-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("recipesSearchPlaceholder")}
          />
        </div>
        <div className="field">
          <label htmlFor="recipe-category">{t("recipesCategory")}</label>
          <select
            id="recipe-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{t("recipesAll")}</option>
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
          <EmptyState title={t("recipesEmptyTitle")} body={t("recipesEmptyBody")} />
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
