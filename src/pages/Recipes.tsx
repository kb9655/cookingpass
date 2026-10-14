import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecipeCard } from "../components/recipe/RecipeCard";
import { EmptyState, ErrorState, PageLoader } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import {
  loadGuestClearedRecipes,
  RECIPE_WORLD_MAX,
  recipeWorld,
  type ClearedRecipeMark,
} from "../lib/recipeWorlds";
import { isSupabaseConfigured } from "../lib/supabase";
import { listCompletedRecipeMarks } from "../services/historyService";
import { listRecipeCategories, listScoredRecipes, recipeMatchesSearch } from "../services/recipeService";
import { getTechniqueProgress } from "../services/techniqueService";
import { listUserIngredients } from "../services/ingredientService";
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
  const [world, setWorld] = useState(1);
  const [clears, setClears] = useState<ClearedRecipeMark[]>(() => loadGuestClearedRecipes());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const showLoader = recipes.length === 0;
    if (showLoader) setLoading(true);
    setError("");

    const pantryTask = listUserIngredients(locale);
    const progressTask =
      user && isSupabaseConfigured ? getTechniqueProgress(user.id) : Promise.resolve([]);
    const clearsTask =
      user && isSupabaseConfigured ? listCompletedRecipeMarks(user.id) : Promise.resolve(loadGuestClearedRecipes());

    Promise.all([listRecipeCategories(locale), pantryTask, progressTask, clearsTask])
      .then(([nextCategories, pantry, progress, nextClears]) => {
        if (cancelled) return [] as ScoredRecipe[];
        setCategories(nextCategories);
        setClears(nextClears);
        return listScoredRecipes({
          locale,
          progress,
          pantry,
          experienceLevel: profile?.experience_level ?? "beginner",
          preferredMaxMinutes: profile?.preferred_max_minutes ?? null,
          availableTools: profile?.available_tools ?? [],
          focusTechniqueId,
        });
      })
      .then((next) => {
        if (!cancelled) setRecipes(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t("recipesLoadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, focusTechniqueId, locale, t, reloadToken]);

  const visible = useMemo(
    () =>
      recipes.filter(
        (recipe) => recipeWorld(recipe.difficulty) === world && recipeMatchesSearch(recipe, query, category),
      ),
    [recipes, query, category, world],
  );
  const clearedIds = useMemo(() => new Set(clears.map((item) => item.id)), [clears]);
  const highlighted = useMemo(
    () => (focusTechniqueId ? visible.filter((item) => item.relatedness === 1) : []),
    [visible, focusTechniqueId],
  );

  return (
    <main className="page">
      <h1 className="text-3xl font-black tracking-tight">{t("recipesTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("recipesLead")}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: RECIPE_WORLD_MAX }, (_, index) => index + 1).map((item) => (
          <button
            key={item}
            type="button"
            className={`min-h-11 rounded-full px-3 text-sm font-bold ${
              world === item ? "bg-accent text-white" : "border border-line bg-card text-ink"
            }`}
            onClick={() => setWorld(item)}
          >
            {t("recipesWorld", { n: item })}
          </button>
        ))}
      </div>

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
          <ErrorState message={error} onRetry={() => setReloadToken((current) => current + 1)} />
        </div>
      ) : null}
      <div className="mt-6 grid list-wide gap-3">
        {loading ? (
          <PageLoader label={t("pageLoading")} />
        ) : visible.length === 0 ? (
          <EmptyState title={t("recipesEmptyTitle")} body={t("recipesEmptyBody")} />
        ) : (
          visible.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              highlight={highlighted.some((item) => item.id === recipe.id)}
              cleared={clearedIds.has(recipe.id)}
            />
          ))
        )}
      </div>
    </main>
  );
}
