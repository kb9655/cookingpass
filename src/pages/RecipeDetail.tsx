import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState, Skeleton } from "../components/common/Feedback";
import { StarRating } from "../components/common/StarRating";
import { getRecipeDetail } from "../services/recipeService";
import { listUserIngredients } from "../services/ingredientService";
import { requestAdjustedRecipe } from "../services/aiService";
import { ApiError } from "../lib/api";
import { useLocale } from "../i18n/locale";
import type { AdjustedRecipe, RecipeDetail } from "../types/recipe";
import type { UserIngredient } from "../types/ingredient";

export function RecipeDetail() {
  const { id = "" } = useParams();
  const { locale, t } = useLocale();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [pantry, setPantry] = useState<UserIngredient[]>([]);
  const [servings, setServings] = useState(2);
  const [notes, setNotes] = useState("");
  const [adjusted, setAdjusted] = useState<AdjustedRecipe | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setAdjusted(null);
    Promise.all([getRecipeDetail(id, locale), listUserIngredients(locale)])
      .then(([next, nextPantry]) => {
        if (!active) return;
        setRecipe(next);
        setPantry(nextPantry);
        if (next) setServings(next.servings);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : t("recipesLoadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, locale, t]);

  async function onAdjust(event: FormEvent) {
    event.preventDefault();
    if (!recipe) return;
    setAdjusting(true);
    setError("");
    try {
      const next = await requestAdjustedRecipe({
        recipeId: recipe.id,
        servings,
        notes,
        locale,
        recipe: {
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          servings: recipe.servings,
          required_tools: recipe.required_tools,
          ingredients: recipe.ingredients.map((item) => ({
            name: item.name,
            amount: item.amount,
            unit: item.unit,
            notes: item.notes,
          })),
          steps: recipe.steps.map((step) => ({
            step_number: step.step_number,
            instruction: step.instruction,
            technique_id: step.technique_id,
          })),
          techniques: recipe.techniques.map((technique) => ({
            id: technique.id,
            name: technique.name,
          })),
        },
        pantry: pantry.map((item) => ({
          name: item.name,
          amount: item.amount,
          unit: item.unit,
        })),
      });
      setAdjusted(next);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("recipeAdjustFailed");
      setError(message);
    } finally {
      setAdjusting(false);
    }
  }

  if (loading) {
    return (
      <main className="page space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="page">
        <ErrorState message={error || t("recipeNotFound")} />
      </main>
    );
  }

  return (
    <main className="page pb-8">
      <p className="text-xs text-muted">
        {recipe.category}
        {recipe.subcategory ? ` · ${recipe.subcategory}` : ""}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{recipe.name}</h1>
      <div className="mt-3 flex items-center gap-3 text-sm text-muted">
        <StarRating value={recipe.difficulty} />
        <span>{t("recipeMinutes", { n: recipe.estimated_minutes })}</span>
        <span>{t("recipeServings", { n: recipe.servings })}</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{recipe.description}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("recipeIngredients")}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {recipe.ingredients.map((item) => (
            <li key={item.ingredient_id + item.name} className="flex justify-between border-b border-line py-2">
              <span>{item.name}</span>
              <span className="text-muted">
                {item.amount || ""}
                {item.amount ? " " : ""}
                {item.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("recipeSteps")}</h2>
        <ol className="mt-3 space-y-3 text-sm text-muted">
          {recipe.steps.map((step) => (
            <li key={step.id}>
              <span className="font-medium text-ink">{step.step_number}. </span>
              {step.instruction}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("recipeTechniques")}</h2>
        {recipe.techniques.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("recipeNoTechniques")}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {recipe.techniques.map((technique) => (
              <Link
                key={technique.id}
                to={`/techniques/${technique.id}`}
                className="rounded-full border border-line bg-card px-3 py-1 text-sm"
              >
                {technique.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <form className="mt-8 space-y-4 rounded-[1.5rem] border border-line bg-card p-4" onSubmit={onAdjust}>
        <h2 className="text-lg font-semibold">{t("recipeAdjustTitle")}</h2>
        <p className="text-sm text-muted">
          {t("recipePantryCount", { n: pantry.length })}{" "}
          <Link to="/ingredients" className="text-accent underline">
            {t("recipeRegisterIngredients")}
          </Link>
        </p>
        <div className="field">
          <label htmlFor="servings">{t("recipeServingsLabel")}</label>
          <input
            id="servings"
            type="number"
            min={1}
            max={8}
            value={servings}
            onChange={(event) => setServings(Number(event.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="notes">{t("recipeNotes")}</label>
          <textarea
            id="notes"
            rows={3}
            placeholder={t("recipeNotesPlaceholder")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {adjusting ? (
          <p className="text-sm text-muted">{t("recipeAdjusting")}</p>
        ) : null}
        <button className="btn-primary w-full" type="submit" disabled={adjusting}>
          {adjusting ? t("recipeAdjustingBtn") : t("recipeAdjustSubmit")}
        </button>
      </form>

      {adjusted ? (
        <section className="mt-8 space-y-6 rounded-[1.5rem] border border-accent/30 bg-card p-4">
          <div>
            <p className="text-xs font-semibold text-accent">{t("recipeClaudeResult")}</p>
            <h2 className="mt-1 text-xl font-semibold">{adjusted.title}</h2>
            <p className="mt-1 text-sm text-muted">{t("recipeServings", { n: adjusted.servings })}</p>
            {adjusted.notes ? <p className="mt-2 text-sm text-muted">{adjusted.notes}</p> : null}
          </div>

          {adjusted.missing_or_substitutions?.length ? (
            <div>
              <h3 className="text-sm font-semibold">{t("recipeSubs")}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {adjusted.missing_or_substitutions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold">{t("recipeAdjustedIngredients")}</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {adjusted.ingredients.map((item) => (
                <li key={`${item.name}-${item.substituted_for ?? ""}`} className="border-b border-line py-2">
                  <div className="flex justify-between gap-3">
                    <span>{item.name}</span>
                    <span className="text-muted">
                      {item.amount} {item.unit}
                    </span>
                  </div>
                  {item.substituted_for ? (
                    <p className="mt-1 text-xs text-accent">
                      {t("recipeSubstitute")}: {item.substituted_for}
                    </p>
                  ) : null}
                  {item.note ? <p className="mt-1 text-xs text-muted">{item.note}</p> : null}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">{t("recipeAdjustedSteps")}</h3>
            <ol className="mt-2 space-y-3 text-sm">
              {adjusted.steps.map((step) => (
                <li key={step.step}>
                  <span className="font-medium">{step.step}. </span>
                  {step.instruction}
                  {step.warnings?.length ? (
                    <p className="mt-1 text-xs text-red-700">{step.warnings.join(" · ")}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
    </main>
  );
}
