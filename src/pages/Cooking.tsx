import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState } from "../components/common/Feedback";
import { ProgressBar } from "../components/common/ProgressBar";
import { CookingStep } from "../components/cooking/CookingStep";
import { LessonProgress } from "../components/technique/LessonProgress";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { XP_PER_CLEAR, XP_PER_STAR, cookingXpFromDifficulty, playerLevelFromXp } from "../lib/playerLevel";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  clearCookingSession,
  loadCookingSession,
  saveCookingDraft,
  type CookingDraft,
} from "../services/aiService";
import {
  saveCookingHistory,
  setPendingCookingSaveRecipe,
  stashPendingCookingSave,
  sumCompletedCookingStars,
} from "../services/historyService";
import { saveUserRecipe } from "../services/userRecipeService";
import { getRecipeDetail } from "../services/recipeService";
import { getTechniqueProgress } from "../services/techniqueService";
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
  const [onSummary, setOnSummary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [techniqueNames, setTechniqueNames] = useState<Record<string, string>>({});
  const [difficulty, setDifficulty] = useState(1);
  const [baseXp, setBaseXp] = useState(0);
  const [gainedXp, setGainedXp] = useState(0);
  const [fromPercent, setFromPercent] = useState(0);
  const [toPercent, setToPercent] = useState(0);
  const [barReady, setBarReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveRecipe, setSaveRecipe] = useState(false);
  const [librarySaved, setLibrarySaved] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const finishedRef = useRef(false);
  const draftRef = useRef<CookingDraft | null>(null);

  useEffect(() => {
    setReady(false);
    setOnSummary(false);
    setBarReady(false);
    setSaveRecipe(false);
    setLibrarySaved(false);
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
    setOnIntro(session.onIntro);
    setReady(true);

    void getRecipeDetail(id).then((detail) => {
      if (!detail) return;
      const names: Record<string, string> = {};
      for (const technique of detail.techniques) names[technique.id] = technique.name;
      setTechniqueNames(names);
      setDifficulty(detail.difficulty);
    });
  }, [id, navigate]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setBaseXp(0);
      return;
    }
    let active = true;
    Promise.all([getTechniqueProgress(user.id), sumCompletedCookingStars(user.id)])
      .then(([rows, stars]) => {
        if (!active) return;
        const cleared = rows.filter((row) => row.status === "cleared").length;
        setBaseXp(playerLevelFromXp(cleared * XP_PER_CLEAR + stars * XP_PER_STAR).totalXp);
      })
      .catch(() => {
        if (active) setBaseXp(0);
      });
    return () => {
      active = false;
    };
  }, [user]);

  draftRef.current =
    recipe && id
      ? { recipeId: id, recipe, startedAt, progressIndex, viewIndex, onIntro }
      : null;

  useEffect(() => {
    if (recipe && id && !onSummary) {
      saveCookingDraft({ recipeId: id, recipe, startedAt, progressIndex, viewIndex, onIntro });
    }
  }, [id, recipe, startedAt, progressIndex, viewIndex, onIntro, onSummary]);

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

  useEffect(() => {
    if (!onSummary) return;
    sessionStorage.setItem("cookingpass:progress-percent", String(fromPercent));
    const frame = requestAnimationFrame(() => setBarReady(true));
    return () => cancelAnimationFrame(frame);
  }, [onSummary, fromPercent]);

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
    if (!recipe) return;
    setSaving(true);
    setError("");
    const gained = cookingXpFromDifficulty(difficulty);
    const fromState = playerLevelFromXp(baseXp);
    const toState = playerLevelFromXp(baseXp + gained);
    setFromPercent(toState.barPercent < fromState.barPercent ? 0 : fromState.barPercent);
    setToPercent(toState.barPercent);
    setGainedXp(gained);

    try {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      if (user) {
        await saveCookingHistory({
          userId: user.id,
          recipeId: id,
          ingredients: recipe.ingredients,
          adjustedRecipe: recipe,
          completed: true,
          durationSeconds,
          techniqueIds: usedTechniqueIds,
        });
      } else {
        stashPendingCookingSave({
          recipeId: id,
          ingredients: recipe.ingredients,
          adjustedRecipe: recipe,
          durationSeconds,
          techniqueIds: usedTechniqueIds,
          saveRecipe: false,
        });
      }
      finishedRef.current = true;
      clearCookingSession(id);
      setOnSummary(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("cookSaveError"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleSaveRecipe(checked: boolean) {
    setError("");
    if (!checked) {
      setSaveRecipe(false);
      if (!user) setPendingCookingSaveRecipe(false);
      return;
    }
    setSaveRecipe(true);
    if (!user) {
      setPendingCookingSaveRecipe(true);
      return;
    }
    if (librarySaved || !recipe) return;
    setSavingRecipe(true);
    try {
      await saveUserRecipe({
        userId: user.id,
        sourceRecipeId: id,
        recipe,
      });
      setLibrarySaved(true);
    } catch (err) {
      setSaveRecipe(false);
      setError(err instanceof Error ? err.message : t("cookSummarySaveError"));
    } finally {
      setSavingRecipe(false);
    }
  }

  if (!ready || !recipe || (!step && !onSummary)) {
    return (
      <main className="page">
        {ready ? <ErrorState message={t("cookSessionMissing")} /> : null}
      </main>
    );
  }

  if (onSummary) {
    return (
      <main className="page pb-8">
        <p className="text-xs font-medium text-muted">{t("cookSummaryTitle")}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight break-keep">{recipe.title}</h1>
        <p className="mt-4 text-2xl font-black text-accent">{t("cookSummaryXp", { n: gainedXp })}</p>
        {barReady ? <ProgressBar value={toPercent} /> : <ProgressBar value={fromPercent} />}
        <label className="mt-6 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={saveRecipe}
            disabled={savingRecipe || librarySaved}
            onChange={(event) => void toggleSaveRecipe(event.target.checked)}
          />
          <span className="min-w-0 break-keep">
            {librarySaved ? t("cookSummarySaved") : t("cookSummarySaveRecipe")}
            {user ? null : (
              <span className="mt-1 block text-muted">{t("cookSummarySaveNeedLogin")}</span>
            )}
          </span>
        </label>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <button className="btn-primary mt-8 w-full" type="button" onClick={() => navigate("/")}>
          {t("cookSummaryHome")}
        </button>
        {user ? null : (
          <button
            className="btn-secondary mt-2 w-full"
            type="button"
            onClick={() => navigate("/login", { state: { from: "/" } })}
          >
            {t("cookSummaryLogin")}
          </button>
        )}
      </main>
    );
  }

  if (!step) {
    return (
      <main className="page">
        <ErrorState message={t("cookSessionMissing")} />
      </main>
    );
  }

  const isLastView = !onIntro && viewIndex === total - 1;
  const canPrev = !onIntro;
  const canNext = onIntro || viewIndex < total - 1;

  return (
    <main className="page-lesson">
      {onIntro ? null : <LessonProgress total={total} current={viewIndex} />}
      <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-1">
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
              <h1 className="mt-2 text-3xl font-semibold tracking-tight break-keep">{recipe.title}</h1>
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
