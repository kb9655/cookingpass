import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorState, Skeleton } from "../components/common/Feedback";
import { StarRating } from "../components/common/StarRating";
import {
  IngredientCheckList,
  type IngredientCheck,
} from "../components/recipe/IngredientCheckList";
import { getRecipeDetail } from "../services/recipeService";
import { listUserIngredients } from "../services/ingredientService";
import { requestAdjustedRecipe } from "../services/aiService";
import { ApiError } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import type { RecipeDetail } from "../types/recipe";
import type { UserIngredient } from "../types/ingredient";

export function RecipeDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [pantry, setPantry] = useState<UserIngredient[]>([]);
  const [checks, setChecks] = useState<IngredientCheck[]>([]);
  const [servings, setServings] = useState(2);
  const [notes, setNotes] = useState("");
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
    Promise.all([getRecipeDetail(id, locale), listUserIngredients("ko")])
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
      await requestAdjustedRecipe({
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
        pantry: checks
          .filter((item) => item.selected)
          .map((item) => ({
            name: item.name,
            amount: item.amount,
            unit: item.unit,
          })),
      });
      if (user) {
        navigate(`/cook/${recipe.id}`);
      } else {
        navigate("/login", { state: { from: `/cook/${recipe.id}` } });
      }
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
        <div className="mt-3">
          <IngredientCheckList ingredients={recipe.ingredients} pantry={pantry} onChange={setChecks} />
        </div>
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
          {t("recipePantryCount", { n: checks.filter((item) => item.selected).length })}
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
          <p className="mb-2 text-xs text-muted">{t("recipeNoteChips")}</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {(
              [
                "recipeNoteChip1",
                "recipeNoteChip2",
                "recipeNoteChip3",
                "recipeNoteChip4",
                "recipeNoteChip5",
              ] as const
            ).map((key) => {
              const label = t(key);
              const selected = notes.includes(label);
              return (
                <button
                  key={key}
                  type="button"
                  className={`min-h-11 rounded-full border px-3 py-1 text-sm ${
                    selected ? "border-accent bg-accent text-white" : "border-line bg-white text-ink"
                  }`}
                  aria-pressed={selected}
                  onClick={() => {
                    if (selected) {
                      setNotes(
                        notes
                          .replace(label, "")
                          .replace(/,\s*,/g, ",")
                          .replace(/^[\s,]+|[\s,]+$/g, "")
                          .replace(/\n{2,}/g, "\n")
                          .trim(),
                      );
                      return;
                    }
                    setNotes(notes.trim() ? `${notes.trim()}, ${label}` : label);
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
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
    </main>
  );
}
