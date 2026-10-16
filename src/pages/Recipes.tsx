import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RecipeCard } from "../components/recipe/RecipeCard";
import { EmptyState, ErrorState, PageLoader } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import {
  catalogWorldMax,
  loadGuestClearedRecipes,
  recipeWorld,
  type ClearedRecipeMark,
} from "../lib/recipeWorlds";
import {
  addFridgeKeywords,
  loadFridgeKeywords,
  rankUseUpScoredRecipes,
  saveFridgeKeywords,
  tokenizeFridgeInput,
  type UseUpRecipe,
} from "../lib/useUpRecipes";
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
  const [draft, setDraft] = useState("");
  const [keywords, setKeywords] = useState<string[]>(() => loadFridgeKeywords());
  const [ignored, setIgnored] = useState(false);
  const [clears, setClears] = useState<ClearedRecipeMark[]>(() => loadGuestClearedRecipes());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    saveFridgeKeywords(keywords);
  }, [keywords]);

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

  const ranked = useMemo<UseUpRecipe[]>(
    () =>
      keywords.length
        ? rankUseUpScoredRecipes(recipes, keywords)
        : recipes.map((recipe) => ({ ...recipe, matchedIngredients: [] })),
    [recipes, keywords],
  );
  const visible = useMemo(
    () =>
      ranked.filter(
        (recipe) => recipeWorld(recipe.difficulty) === world && recipeMatchesSearch(recipe, query, category),
      ),
    [ranked, query, category, world],
  );
  const worldMax = useMemo(() => catalogWorldMax(recipes), [recipes]);
  const clearedIds = useMemo(() => new Set(clears.map((item) => item.id)), [clears]);

  useEffect(() => {
    if (world > worldMax) setWorld(1);
  }, [world, worldMax]);
  const highlighted = useMemo(
    () => (focusTechniqueId ? visible.filter((item) => item.relatedness === 1) : []),
    [visible, focusTechniqueId],
  );

  function commitDraft() {
    const { next, ignored: nextIgnored } = addFridgeKeywords(keywords, tokenizeFridgeInput(draft));
    setKeywords(next);
    setIgnored(nextIgnored);
    setDraft("");
  }

  function onKeywordSubmit(event: FormEvent) {
    event.preventDefault();
    commitDraft();
  }

  return (
    <main className="page">
      <h1 className="text-3xl font-black tracking-tight">{t("recipesTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("recipesLead")}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: worldMax }, (_, index) => index + 1).map((item) => (
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
        <form className="space-y-2" onSubmit={onKeywordSubmit}>
          <div className="field">
            <label htmlFor="recipe-ingredients">{t("fridgeKeywords")}</label>
            <div className="flex gap-2">
              <input
                id="recipe-ingredients"
                className="min-w-0 flex-1"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setIgnored(false);
                }}
                placeholder={t("fridgePlaceholder")}
              />
              <button className="btn-primary shrink-0 px-4" type="submit">
                {t("fridgeAdd")}
              </button>
            </div>
          </div>
          {keywords.length ? (
            <ul className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <li key={keyword}>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-accent/40 bg-card px-3 text-sm font-bold text-accent"
                    onClick={() => {
                      setKeywords(keywords.filter((item) => item !== keyword));
                      setIgnored(false);
                    }}
                    aria-label={t("fridgeRemove", { name: keyword })}
                  >
                    {keyword}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {ignored ? <p className="text-sm text-muted">{t("fridgeLimit")}</p> : null}
        </form>
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
          <EmptyState
            title={keywords.length ? t("fridgeEmptyTitle") : t("recipesEmptyTitle")}
            body={keywords.length ? t("fridgeEmptyBody") : t("recipesEmptyBody")}
          />
        ) : (
          visible.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              highlight={highlighted.some((item) => item.id === recipe.id)}
              matchedIngredients={recipe.matchedIngredients.length ? recipe.matchedIngredients : undefined}
              cleared={clearedIds.has(recipe.id)}
            />
          ))
        )}
      </div>
    </main>
  );
}
