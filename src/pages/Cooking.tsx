import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState } from "../components/common/Feedback";
import { CookingStep } from "../components/cooking/CookingStep";
import { LessonProgress } from "../components/technique/LessonProgress";
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
  const [onIntro, setOnIntro] = useState(true);
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
    setOnIntro(session.progressIndex === 0 && session.viewIndex === 0);
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
    if (onIntro) {
      setOnIntro(false);
      return;
    }
    const nextView = Math.min(total - 1, viewIndex + 1);
    setViewIndex(nextView);
    if (nextView >= progressIndex) setProgressIndex(nextView);
  }

  function goPrev() {
    if (!onIntro && viewIndex === 0) {
      setOnIntro(true);
      return;
    }
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

  const isLastView = !onIntro && viewIndex === total - 1;
  const canPrev = !onIntro;
  const canNext = onIntro || viewIndex < total - 1;

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-lg flex-col px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {onIntro ? null : <LessonProgress total={total} current={viewIndex} />}
      <div className="flex min-h-0 flex-1 items-stretch gap-1">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-center text-ink disabled:text-line"
          aria-label={t("cookPrev")}
          disabled={!canPrev}
          onClick={goPrev}
        >
          <ChevronLeft className="h-8 w-8" strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1 overflow-y-auto py-4">
          {onIntro ? (
            <div>
              <p className="text-xs font-medium text-muted">{t("cookIntro")}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">{recipe.title}</h1>
              <p className="mt-3 text-sm text-muted">{t("recipeServings", { n: recipe.servings })}</p>
              {recipe.notes ? <p className="mt-4 text-sm leading-relaxed text-muted">{recipe.notes}</p> : null}
              <Link to={`/recipes/${id}`} className="mt-6 inline-block text-sm font-medium text-accent">
                {t("cookLeave")}
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-muted">{t("cookExplainStep")}</p>
              <p className="mt-1 text-xs text-muted">STEP {step.step}</p>
              <div className="mt-3">
                <CookingStep
                  step={step}
                  techniqueName={step.technique_id ? techniqueNames[step.technique_id] : undefined}
                />
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-center text-ink disabled:text-line"
          aria-label={t("cookNext")}
          disabled={!canNext}
          onClick={goNext}
        >
          <ChevronRight className="h-8 w-8" strokeWidth={2} />
        </button>
      </div>
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      <button
        className="btn-primary mb-2 min-h-11 w-full"
        type="button"
        disabled={saving || (!canNext && !isLastView)}
        onClick={isLastView ? () => void complete() : goNext}
      >
        {saving ? t("cookSaving") : isLastView ? t("cookDone") : t("cookNext")}
      </button>
    </main>
  );
}
