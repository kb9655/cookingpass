import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEmergencyChatPage } from "../components/chat/EmergencyChatProvider";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ErrorState } from "../components/common/Feedback";
import { XpGainCelebrate } from "../components/common/XpGainCelebrate";
import { CookingStep } from "../components/cooking/CookingStep";
import { CookingTimerDock } from "../components/cooking/CookingTimerDock";
import { LessonProgress } from "../components/technique/LessonProgress";
import { useAuth } from "../hooks/useAuth";
import { useWaitTimer } from "../hooks/useWaitTimer";
import { useLocale } from "../i18n/locale";
import { setSkipTimerLeaveConfirm, shouldConfirmTimerLeave, timerStepSnippet } from "../lib/cookTimer";
import { fileToJpegBlob } from "../lib/compressImage";
import { addJournalPhoto, journalOwnerId, JournalQuotaError } from "../lib/journalStore";
import { bumpGuestCookCount } from "../lib/achievements";
import { recordGuestClearedRecipe } from "../lib/recipeWorlds";
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
  const [fromLevel, setFromLevel] = useState(1);
  const [toLevel, setToLevel] = useState(1);
  const [barReady, setBarReady] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveRecipe, setSaveRecipe] = useState(false);
  const [librarySaved, setLibrarySaved] = useState(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [dontAskLeave, setDontAskLeave] = useState(false);
  const [worldNote, setWorldNote] = useState("");
  const [journalNote, setJournalNote] = useState("");
  const [journalBusy, setJournalBusy] = useState(false);
  const cookSessionId = useMemo(() => `cook:${id}:${startedAt}`, [id, startedAt]);
  const finishedRef = useRef(false);
  const draftRef = useRef<CookingDraft | null>(null);
  const { timers: waitTimers, start: startWait, pause: pauseWait, reset: resetWait, clear: clearWait } =
    useWaitTimer(recipe?.title || t("cookTimerNotifyTitle"), (stepLabel) =>
      t("cookTimerNotifyBody", { step: stepLabel }),
    );
  const currentWait = waitTimers.find((item) => item.stepIndex === viewIndex) ?? null;

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
  const chatContext = useMemo(() => {
    if (!recipe) return null;
    const stage = onSummary
      ? t("cookSummaryTitle")
      : onIntro
        ? t("cookIntro")
        : `STEP ${step?.step ?? viewIndex + 1} / ${total}`;
    return {
      key: `cooking:${id}`,
      kind: "cooking" as const,
      title: recipe.title,
      stage,
      instruction: onIntro ? recipe.notes ?? "" : step?.instruction ?? "",
      warnings: step?.warnings ?? [],
      ingredients: step?.ingredients?.length
        ? step.ingredients
        : recipe.ingredients.map((item) => item.name),
      tools: step?.tools ?? [],
    };
  }, [id, recipe, step, viewIndex, total, onIntro, onSummary, t]);
  useEmergencyChatPage(chatContext);

  function advanceNext() {
    if (!recipe) return;
    if (onIntro) {
      setOnIntro(false);
      return;
    }
    const nextView = Math.min(total - 1, viewIndex + 1);
    setViewIndex(nextView);
    if (nextView >= progressIndex) setProgressIndex(nextView);
  }

  function goNext() {
    if (!recipe || onIntro) {
      advanceNext();
      return;
    }
    if (currentWait?.running && shouldConfirmTimerLeave()) {
      setDontAskLeave(false);
      setLeaveOpen(true);
      return;
    }
    advanceNext();
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
    setFromPercent(fromState.barPercent);
    setToPercent(toState.barPercent);
    setFromLevel(fromState.level);
    setToLevel(toState.level);
    setGainedXp(gained);

    try {
      clearWait();
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
      if (!user) bumpGuestCookCount();
      recordGuestClearedRecipe(id, difficulty);
      setWorldNote(t("cookSummaryWorldStay"));
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

  async function addCookPhoto(file: File | null) {
    if (!file || !recipe) return;
    setJournalBusy(true);
    setJournalNote("");
    try {
      const blob = await fileToJpegBlob(file);
      await addJournalPhoto({
        ownerId: journalOwnerId(user?.id),
        kind: "cook",
        title: recipe.title,
        recipeId: id,
        sessionId: cookSessionId,
        blob,
      });
      setJournalNote(t("cookJournalAdded"));
    } catch (err) {
      setJournalNote(err instanceof JournalQuotaError ? t("journalQuota") : t("journalSaveError"));
    } finally {
      setJournalBusy(false);
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
        <p className="text-base font-medium text-muted">{t("cookSummaryTitle")}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight break-keep">{recipe.title}</h1>
        <XpGainCelebrate
          gainedXp={gainedXp}
          fromPercent={fromPercent}
          toPercent={toPercent}
          fromLevel={fromLevel}
          toLevel={toLevel}
          animate={barReady}
        />
        {worldNote ? <p className="mt-3 text-lg font-semibold text-accent">{worldNote}</p> : null}
        <label className="btn-secondary mt-6 w-full cursor-pointer">
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            disabled={journalBusy}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              event.target.value = "";
              void addCookPhoto(file);
            }}
          />
          {journalBusy ? t("pageLoading") : t("cookJournalPhoto")}
        </label>
        {journalNote ? <p className="mt-2 text-sm text-muted">{journalNote}</p> : null}
        <label className="mt-6 flex items-start gap-3 text-lg">
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
              <p className="text-base font-medium text-muted">{t("cookIntro")}</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight break-keep">{recipe.title}</h1>
              <p className="mt-3 text-lg text-muted">{t("recipeServings", { n: recipe.servings })}</p>
              {recipe.notes ? <p className="mt-4 text-xl leading-relaxed text-ink">{recipe.notes}</p> : null}
              <Link to={`/recipes/${id}`} className="mt-6 inline-block text-base font-medium text-accent">
                {t("cookLeave")}
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-lg font-medium text-muted">{t("cookExplainStep")}</p>
              <p className="mt-1 text-3xl font-black tracking-tight">STEP {step.step}</p>
              <div className="mt-3">
                <CookingStep
                  step={step}
                  techniqueName={step.technique_id ? techniqueNames[step.technique_id] : undefined}
                  waitTimer={currentWait}
                  onTimerStart={() => {
                    startWait({
                      stepIndex: viewIndex,
                      stepNumber: step.step,
                      label: timerStepSnippet(step.instruction),
                      minutes: step.time_minutes ?? 0,
                    });
                  }}
                  onTimerPause={() => {
                    pauseWait(viewIndex);
                  }}
                  onTimerReset={() => {
                    resetWait(viewIndex);
                  }}
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
      <CookingTimerDock
        timers={waitTimers}
        activeStepIndex={viewIndex}
        onOpenStep={(stepIndex) => {
          setOnIntro(false);
          setViewIndex(stepIndex);
        }}
      />
      <button
        className="btn-primary mb-2 min-h-16 w-full text-xl"
        type="button"
        disabled={saving || (!canNext && !isLastView)}
        onClick={isLastView ? () => void complete() : goNext}
      >
        {saving ? t("cookSaving") : isLastView ? t("cookDone") : t("cookNext")}
      </button>
      {leaveOpen ? (
        <ConfirmDialog
          title={t("cookTimerLeaveTitle")}
          confirmLabel={t("cookTimerLeaveConfirm")}
          cancelLabel={t("cookTimerLeaveStay")}
          onConfirm={() => {
            if (dontAskLeave) setSkipTimerLeaveConfirm();
            setLeaveOpen(false);
            advanceNext();
          }}
          onClose={() => setLeaveOpen(false)}
        >
          <p>{t("cookTimerLeaveLead")}</p>
          <label className="mt-3 flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={dontAskLeave}
              onChange={(event) => setDontAskLeave(event.target.checked)}
            />
            <span>{t("cookTimerLeaveDontAsk")}</span>
          </label>
        </ConfirmDialog>
      ) : null}
    </main>
  );
}
