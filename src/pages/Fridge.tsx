import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { loadGuestClearedRecipes, type ClearedRecipeMark } from "../lib/recipeWorlds";
import { isSupabaseConfigured } from "../lib/supabase";
import { listCompletedRecipeMarks } from "../services/historyService";
import { EmptyState, ErrorState, PageLoader } from "../components/common/Feedback";
import { RecipeCard } from "../components/recipe/RecipeCard";
import { useLocale } from "../i18n/locale";
import {
  addFridgeKeywords,
  loadFridgeKeywords,
  rankUseUpRecipes,
  saveFridgeKeywords,
  tokenizeFridgeInput,
  type UseUpRecipe,
} from "../lib/useUpRecipes";
import { listParsedRecipes } from "../services/recipeService";

export function Fridge() {
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const [clears, setClears] = useState<ClearedRecipeMark[]>(() => loadGuestClearedRecipes());
  const [draft, setDraft] = useState("");
  const [keywords, setKeywords] = useState<string[]>(() => loadFridgeKeywords());
  const [ignored, setIgnored] = useState(false);
  const [recipes, setRecipes] = useState<UseUpRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    saveFridgeKeywords(keywords);
  }, [keywords]);

  useEffect(() => {
    if (keywords.length === 0) {
      setRecipes([]);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    const clearsTask =
      user && isSupabaseConfigured ? listCompletedRecipeMarks(user.id) : Promise.resolve(loadGuestClearedRecipes());
    Promise.all([listParsedRecipes(locale), clearsTask])
      .then(([records, nextClears]) => {
        if (cancelled) return;
        setClears(nextClears);
        setRecipes(rankUseUpRecipes(records, keywords));
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
  }, [keywords, locale, t, reloadToken, user]);

  function commitDraft() {
    const { next, ignored: nextIgnored } = addFridgeKeywords(keywords, tokenizeFridgeInput(draft));
    setKeywords(next);
    setIgnored(nextIgnored);
    setDraft("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    commitDraft();
  }

  return (
    <main className="page">
      <h1 className="text-3xl font-black tracking-tight">{t("fridgeTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("fridgeLead")}</p>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="fridge-keywords">{t("fridgeKeywords")}</label>
          <div className="flex gap-2">
            <input
              id="fridge-keywords"
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

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} onRetry={() => setReloadToken((current) => current + 1)} />
        </div>
      ) : null}

      <div className="mt-6 grid list-wide gap-3">
        {keywords.length === 0 ? (
          <EmptyState title={t("fridgeIdleTitle")} body={t("fridgeIdleBody")} />
        ) : loading ? (
          <PageLoader label={t("pageLoading")} />
        ) : recipes.length === 0 ? (
          <EmptyState title={t("fridgeEmptyTitle")} body={t("fridgeEmptyBody")} />
        ) : (
          recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              matchedIngredients={recipe.matchedIngredients}
              cleared={clears.some((item) => item.id === recipe.id)}
            />
          ))
        )}
      </div>
    </main>
  );
}
