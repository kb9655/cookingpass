import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState } from "../components/common/Feedback";
import { CookingStep } from "../components/cooking/CookingStep";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import {
  clearCookingSession,
  loadCookingSession,
  saveCookingDraft,
  type CookingDraft,
} from "../services/aiService";
import { saveCookingHistory } from "../services/historyService";
import { getRecipeDetail } from "../services/recipeService";
import type { AdjustedRecipe } from "../types/recipe";

export function Cooking() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLocale();
  const [recipe, setRecipe] = useState<AdjustedRecipe | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [viewIndex, setViewIndex] = useState(0);
  const [progressIndex, setProgressIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [techniqueNames, setTechniqueNames] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const finishedRef = useRef(false);
  const draftRef = useRef<CookingDraft | null>(null);

  useEffect(() => {
    setReady(false);
    const session = loadCookingSession(id);
    if (!session) {
      navigate(`/recipes/${id}`, { replace: true });
      return;
    }
    const last = Math.max(0, session.recipe.steps.length - 1);
    setRecipe(session.recipe);
    setStartedAt(session.startedAt);
    setProgressIndex(Math.min(session.progressIndex, last));
    setViewIndex(Math.min(session.viewIndex, last));
    setReady(true);

    void getRecipeDetail(id).then((detail) => {
      if (!detail) return;
      const names: Record<string, string> = {};
      for (const technique of detail.techniques) names[technique.id] = technique.name;
      setTechniqueNames(names);
    });
  }, [id, navigate]);

  draftRef.current =
    recipe && id
      ? { recipeId: id, recipe, startedAt, progressIndex, viewIndex }
      : null;

  useEffect(() => {
    if (recipe && id) {
      saveCookingDraft({ recipeId: id, recipe, startedAt, progressIndex, viewIndex });
    }
  }, [id, recipe, startedAt, progressIndex, viewIndex]);

  useEffect(() => {
    function persist() {
      if (finishedRef.current || !draftRef.current) return;
      saveCookingDraft(draftRef.current);
    }
    window.addEventListener("beforeunload", persist);
    return () => {
      persist();
      window.removeEventListener("beforeunload", persist);
    };
  }, []);

  const total = recipe?.steps.length ?? 0;
  const step = recipe?.steps[viewIndex];
  const usedTechniqueIds = useMemo(() => {
    if (!recipe) return [];
    return [
      ...new Set(
        recipe.steps
          .map((item) => item.technique_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
  }, [recipe]);

  function goNext() {
    if (!recipe) return;
    const nextView = Math.min(total - 1, viewIndex + 1);
    setViewIndex(nextView);
    if (nextView >= progressIndex) setProgressIndex(nextView);
  }

  function goPrev() {
    setViewIndex((value) => Math.max(0, value - 1));
  }

  async function complete() {
    if (!user || !recipe) return;
    setSaving(true);
    setError("");
    try {
      await saveCookingHistory({
        userId: user.id,
        recipeId: id,
        ingredients: recipe.ingredients,
        adjustedRecipe: recipe,
        completed: true,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        techniqueIds: usedTechniqueIds,
      });
      finishedRef.current = true;
      clearCookingSession(id);
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cookSaveError"));
    } finally {
      setSaving(false);
    }
  }

  if (!ready || !recipe || !step) {
    return (
      <main className="page">
        {ready ? <ErrorState message={t("cookSessionMissing")} /> : null}
      </main>
    );
  }

  const isLastView = viewIndex === total - 1;

  return (
    <main className="page flex min-h-[calc(100dvh-8.5rem)] flex-col pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">
            {t("cookProgress", { current: progressIndex + 1, total })}
          </p>
          <h1 className="mt-1 text-lg font-semibold leading-snug">{recipe.title}</h1>
        </div>
        <Link to={`/recipes/${id}`} className="shrink-0 pt-1 text-sm text-muted">
          {t("cookLeave")}
        </Link>
      </div>

      <ol className="mt-4 flex flex-wrap gap-2" aria-label={t("cookProgress", { current: progressIndex + 1, total })}>
        {recipe.steps.map((item, index) => {
          const viewing = index === viewIndex;
          const current = index === progressIndex;
          return (
            <li key={item.step}>
              <button
                type="button"
                onClick={() => setViewIndex(index)}
                aria-current={viewing ? "step" : undefined}
                aria-label={`${index + 1}${current ? `, ${t("cookCurrent")}` : ""}${viewing ? `, ${t("cookViewing")}` : ""}`}
                className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                  viewing
                    ? "bg-accent text-white"
                    : current
                      ? "border-2 border-accent bg-card text-accent"
                      : "border border-line bg-card text-muted"
                }`}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex-1">
        <CookingStep
          step={step}
          recipeTitle={recipe.title}
          techniqueName={step.technique_id ? techniqueNames[step.technique_id] : undefined}
        />
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={goPrev}
          disabled={viewIndex === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" strokeWidth={1.75} />
          {t("cookPrev")}
        </button>
        {isLastView ? (
          <button type="button" className="btn-primary flex-1" onClick={complete} disabled={saving}>
            {saving ? t("cookSaving") : t("cookDone")}
          </button>
        ) : (
          <button type="button" className="btn-primary flex-1" onClick={goNext}>
            {t("cookNext")}
            <ChevronRight className="ml-1 h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </main>
  );
}
