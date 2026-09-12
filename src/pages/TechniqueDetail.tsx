import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { MediaSlot } from "../components/common/MediaSlot";
import { ErrorState, Skeleton } from "../components/common/Feedback";
import { StarRating } from "../components/common/StarRating";
import { LessonProgress } from "../components/technique/LessonProgress";
import { ScoreStars } from "../components/technique/ScoreStars";
import { TechniqueCard } from "../components/technique/TechniqueCard";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { ApiError, evaluateTechnique } from "../lib/api";
import { fileToJpegBase64 } from "../lib/compressImage";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  getTechniqueDetail,
  getTechniqueProgress,
  resetTechniqueProgress,
  saveTechniqueScores,
} from "../services/techniqueService";
import type {
  TechniqueCriterion,
  TechniqueDetail,
  TechniqueEvaluation,
  TechniqueProgress,
  TechniqueProgressStatus,
  TechniqueStep,
} from "../types/technique";

type WizardScreen =
  | { type: "intro" }
  | { type: "caution" }
  | { type: "practice"; stepIndex: number }
  | { type: "feedback"; stepIndex: number }
  | { type: "summary" };

type StepEvalStatus = "scored" | "skipped" | "invalid";
type EvalPopup = "no-photo" | "bad-photo" | null;

function buildScreens(stepCount: number): WizardScreen[] {
  const screens: WizardScreen[] = [{ type: "intro" }, { type: "caution" }];
  for (let index = 0; index < stepCount; index += 1) {
    screens.push({ type: "practice", stepIndex: index });
    screens.push({ type: "feedback", stepIndex: index });
  }
  screens.push({ type: "summary" });
  return screens;
}

function aggregateScores(results: TechniqueEvaluation[]): number[] {
  const totals = [0, 0, 0];
  for (const result of results) {
    for (let index = 0; index < 3; index += 1) {
      totals[index] += result.last_item_scores[index] ?? 1;
    }
  }
  const count = Math.max(results.length, 1);
  return totals.map((sum) => Math.round(sum / count));
}

function passedFromScores(criteria: TechniqueCriterion[], scores: number[]): boolean {
  const safetyOk = criteria
    .filter((item) => item.is_safety)
    .every((item) => (scores[item.sort_order - 1] ?? 1) >= 2);
  const achieved = scores.filter((score) => score >= 2).length;
  return safetyOk && achieved >= 2;
}

export function TechniqueDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLocale();
  const [detail, setDetail] = useState<TechniqueDetail | null>(null);
  const [status, setStatus] = useState<TechniqueProgressStatus>("unlocked");
  const [progress, setProgress] = useState<TechniqueProgress[]>([]);
  const [photos, setPhotos] = useState<Record<string, File | null>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [stepResults, setStepResults] = useState<Record<string, TechniqueEvaluation>>({});
  const [stepStatus, setStepStatus] = useState<Record<string, StepEvalStatus>>({});
  const [popup, setPopup] = useState<EvalPopup>(null);
  const [retryClearedOpen, setRetryClearedOpen] = useState(false);
  const [resettingCleared, setResettingCleared] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screenIndex, setScreenIndex] = useState(0);
  const evaluateStarted = useRef<Record<string, boolean>>({});
  const progressSaved = useRef(false);
  const clearedAcked = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setStepResults({});
    setStepStatus({});
    setPopup(null);
    setRetryClearedOpen(false);
    setResettingCleared(false);
    setPhotos({});
    setPreviews({});
    setScreenIndex(0);
    evaluateStarted.current = {};
    progressSaved.current = false;
    clearedAcked.current = false;
    Promise.all([
      getTechniqueDetail(id),
      user ? getTechniqueProgress(user.id) : Promise.resolve([]),
    ])
      .then(([next, nextProgress]) => {
        if (!active) return;
        setDetail(next);
        setProgress(nextProgress);
        const found = nextProgress.find((item) => item.technique_id === id);
        setStatus(found?.status ?? "unlocked");
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : t("techniquesLoadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user, t]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(previews)) URL.revokeObjectURL(url);
    };
  }, [previews]);

  const screens = useMemo(() => buildScreens(detail?.steps.length ?? 0), [detail?.steps.length]);
  const screen = screens[Math.min(screenIndex, screens.length - 1)] ?? { type: "intro" as const };

  function onPickPhoto(stepId: string, file: File | null) {
    setPhotos((current) => ({ ...current, [stepId]: file }));
    setPreviews((current) => {
      const next = { ...current };
      if (current[stepId]) URL.revokeObjectURL(current[stepId]);
      if (file) next[stepId] = URL.createObjectURL(file);
      else delete next[stepId];
      return next;
    });
  }

  function stepHasPhoto(step: TechniqueStep | undefined) {
    return Boolean(step && photos[step.id]);
  }

  function canLeave(from: WizardScreen) {
    if (from.type === "feedback" && detail) {
      const stepId = detail.steps[from.stepIndex]?.id;
      return Boolean(stepId && stepStatus[stepId]);
    }
    return true;
  }

  function nextIndexAfterPractice(stepIndex: number) {
    const nextPractice = screens.findIndex(
      (item) => item.type === "practice" && item.stepIndex === stepIndex + 1,
    );
    if (nextPractice >= 0) return nextPractice;
    return screens.findIndex((item) => item.type === "summary");
  }

  const canPrev = screenIndex > 0;
  const canNext =
    screenIndex < screens.length - 1 && canLeave(screen) && !saving && screen.type !== "summary";

  async function runEvaluateStep(step: TechniqueStep) {
    if (!detail) return;
    if (!user) {
      navigate("/login", { state: { from: `/techniques/${id}` } });
      return;
    }
    const file = photos[step.id];
    if (!file) {
      setError(t("techniquesNeedPhoto"));
      evaluateStarted.current[step.id] = false;
      return;
    }
    setSaving(true);
    setError("");
    try {
      const jpeg = await fileToJpegBase64(file);
      const next = await evaluateTechnique({
        techniqueId: detail.id,
        stepNumber: step.step_number,
        persistProgress: false,
        photos: [{ step_number: step.step_number, ...jpeg }],
      });
      if (next.image_relevant === false) {
        setStepStatus((current) => ({ ...current, [step.id]: "invalid" }));
        setStepResults((current) => {
          const copy = { ...current };
          delete copy[step.id];
          return copy;
        });
        setPopup("bad-photo");
        return;
      }
      setStepStatus((current) => ({ ...current, [step.id]: "scored" }));
      setStepResults((current) => ({ ...current, [step.id]: next }));
    } catch (err) {
      evaluateStarted.current[step.id] = false;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("techniquesEvalFailed");
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (screen.type !== "feedback" || !detail) return;
    const step = detail.steps[screen.stepIndex];
    if (!step) return;
    if (stepStatus[step.id] === "skipped" || stepStatus[step.id] === "invalid") return;
    if (!photos[step.id]) return;
    if (stepResults[step.id] || evaluateStarted.current[step.id]) return;
    evaluateStarted.current[step.id] = true;
    void runEvaluateStep(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, detail, stepResults, stepStatus, photos]);

  const acceptedResults = useMemo(() => {
    if (!detail) return [];
    return detail.steps
      .filter((step) => stepStatus[step.id] === "scored")
      .map((step) => stepResults[step.id])
      .filter((item): item is TechniqueEvaluation => Boolean(item));
  }, [detail, stepResults, stepStatus]);

  const allStepsResolved = Boolean(
    detail && detail.steps.length > 0 && detail.steps.every((step) => stepStatus[step.id]),
  );
  const summaryScores = useMemo(
    () => (acceptedResults.length > 0 ? aggregateScores(acceptedResults) : null),
    [acceptedResults],
  );
  const summaryPassed = useMemo(
    () =>
      Boolean(detail && summaryScores && passedFromScores(detail.criteria, summaryScores)),
    [detail, summaryScores],
  );

  useEffect(() => {
    if (screen.type !== "summary" || !detail || !user || progressSaved.current) return;
    if (!allStepsResolved) return;
    progressSaved.current = true;
    void saveTechniqueScores(user.id, detail.id, summaryScores, summaryPassed, detail.parent_id)
      .then(() => {
        if (summaryPassed) setStatus("cleared");
      })
      .catch(() => {
        progressSaved.current = false;
        setError(t("techniquesEvalFailed"));
      });
  }, [screen.type, detail, user, allStepsResolved, summaryScores, summaryPassed, t]);

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= screens.length) return;
    if (nextIndex > screenIndex && !canLeave(screen)) {
      setError(t("techniquesEvaluating"));
      return;
    }
    setError("");
    setScreenIndex(nextIndex);
  }

  function goBack() {
    let dest = screenIndex - 1;
    while (dest >= 0 && detail) {
      const target = screens[dest];
      if (target?.type === "feedback") {
        const targetStep = detail.steps[target.stepIndex];
        if (targetStep && stepStatus[targetStep.id] !== "scored") {
          dest -= 1;
          continue;
        }
      }
      goTo(dest);
      return;
    }
    if (dest >= 0) goTo(dest);
  }

  async function confirmRetryCleared() {
    if (!detail) return;
    setResettingCleared(true);
    setError("");
    try {
      if (user) {
        await resetTechniqueProgress(user.id, detail.id, detail.parent_id);
      }
      setStatus("unlocked");
      progressSaved.current = false;
      clearedAcked.current = true;
      setRetryClearedOpen(false);
      goTo(screenIndex + 1);
    } catch {
      setError(t("profileResetError"));
    } finally {
      setResettingCleared(false);
    }
  }

  function goForward() {
    if (screen.type === "intro" && status === "cleared" && !clearedAcked.current) {
      setRetryClearedOpen(true);
      return;
    }
    if (screen.type === "practice" && detail) {
      const current = detail.steps[screen.stepIndex];
      if (current && !stepHasPhoto(current)) {
        setStepStatus((value) => ({ ...value, [current.id]: "skipped" }));
        setStepResults((value) => {
          const next = { ...value };
          delete next[current.id];
          return next;
        });
        setPopup("no-photo");
        const dest = nextIndexAfterPractice(screen.stepIndex);
        if (dest >= 0) setScreenIndex(dest);
        return;
      }
    }
    goTo(screenIndex + 1);
  }

  function retryCurrentStep() {
    if (!detail || (screen.type !== "feedback" && screen.type !== "practice")) return;
    const step = detail.steps[screen.stepIndex];
    if (!step) return;
    evaluateStarted.current[step.id] = false;
    setStepStatus((current) => {
      const next = { ...current };
      delete next[step.id];
      return next;
    });
    setStepResults((current) => {
      const next = { ...current };
      delete next[step.id];
      return next;
    });
    onPickPhoto(step.id, null);
    const practiceIndex = screens.findIndex(
      (item) => item.type === "practice" && item.stepIndex === screen.stepIndex,
    );
    setError("");
    if (practiceIndex >= 0) setScreenIndex(practiceIndex);
  }

  if (loading) {
    return (
      <main className="page space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="aspect-[4/3] w-full" />
      </main>
    );
  }

  if (error && !detail) {
    return (
      <main className="page">
        <ErrorState message={error} />
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="page">
        <ErrorState message={t("techniquesEmpty")} />
      </main>
    );
  }

  const isParent = detail.children.length > 0;
  if (isParent) {
    return (
      <main className="page pb-8">
        <Link to="/techniques" className="text-sm font-medium text-accent">
          {t("techniquesTitle")}
        </Link>
        <p className="mt-4 text-sm text-muted">
          Stage {String(detail.stage_number > 70 ? 7 : detail.stage_number).padStart(2, "0")}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{detail.name}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">{detail.description}</p>
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("techniquesVariants")}</h2>
          <p className="mt-2 text-sm text-muted">{t("techniquesVariantsLead")}</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {detail.children.map((child, index) => {
              const childProgress = progress.find((item) => item.technique_id === child.id);
              return (
                <TechniqueCard
                  key={child.id}
                  technique={{ ...child, stage_number: index + 1 }}
                  status={childProgress?.status ?? "unlocked"}
                  scores={childProgress?.last_item_scores}
                />
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  const step =
    screen.type === "practice" || screen.type === "feedback"
      ? detail.steps[screen.stepIndex]
      : undefined;
  const showDots = screen.type === "practice" || screen.type === "feedback";
  const currentStep =
    screen.type === "practice" || screen.type === "feedback" ? screen.stepIndex : 0;
  const unlearnedRelated = detail.related.filter((item) => {
    if (item.id === detail.id) return false;
    return progress.find((row) => row.technique_id === item.id)?.status !== "cleared";
  });
  const stepResult = step ? stepResults[step.id] : undefined;

  let body: ReactNode = null;
  if (screen.type === "intro") {
    body = (
      <div>
        <p className="text-sm text-muted">
          Stage {String(detail.stage_number).padStart(2, "0")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{detail.name}</h1>
        <div className="mt-3 flex items-center gap-3 text-sm text-muted">
          <StarRating value={detail.difficulty} />
          <span>{t("techniquesMinutes", { n: detail.estimated_minutes })}</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">{detail.description}</p>
        {detail.criteria.length > 0 ? (
          <div className="card-casual mt-5 p-4">
            <p className="text-sm font-semibold">{t("techniquesCriteria")}</p>
            <ol className="mt-3 space-y-2">
              {detail.criteria.map((item) => (
                <li key={item.id}>
                  <p className="text-sm font-medium">
                    {item.sort_order}. {item.name}
                    {item.is_safety ? (
                      <span className="ml-2 text-xs text-red-700">{t("techniquesSafety")}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">{item.check_hint}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {status === "cleared" ? (
          <p className="mt-6 text-sm font-semibold text-accent">{t("techniquesAlreadyCleared")}</p>
        ) : null}
      </div>
    );
  } else if (screen.type === "caution") {
    body = (
      <div>
        <h2 className="text-2xl font-semibold">{t("techniquesPrecautions")}</h2>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          {detail.precautions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  } else if (screen.type === "practice" && step) {
    body = (
      <div>
        <p className="text-xs text-muted">STEP {step.step_number}</p>
        {step.title ? <h2 className="mt-2 text-2xl font-semibold">{step.title}</h2> : null}
        <p className="mt-3 text-sm leading-relaxed text-muted">{step.instruction}</p>
        <div className="mt-4">
          <MediaSlot media={step.media} label={step.title ?? `${detail.name} ${step.step_number}`} />
        </div>
        {detail.capture_hint ? (
          <p className="mt-4 rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
            {detail.capture_hint}
          </p>
        ) : null}
        {detail.target_size ? (
          <p className="mt-2 text-sm text-muted">{t("techniquesTargetSize", { size: detail.target_size })}</p>
        ) : null}
        {detail.criteria.length > 0 ? (
          <div className="card-casual mt-4 p-4">
            <p className="text-sm font-semibold">{t("techniquesCriteria")}</p>
            <ol className="mt-3 space-y-2">
              {detail.criteria.map((item) => (
                <li key={item.id}>
                  <p className="text-sm font-medium">
                    {item.sort_order}. {item.name}
                    {item.is_safety ? (
                      <span className="ml-2 text-xs text-red-700">{t("techniquesSafety")}</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">{item.check_hint}</p>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <label className="btn-secondary mt-4 w-full cursor-pointer">
          <input
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => onPickPhoto(step.id, event.target.files?.[0] ?? null)}
          />
          {previews[step.id] ? t("techniquesChangePhoto") : t("techniquesPickPhoto")}
        </label>
        {previews[step.id] ? (
          <img
            src={previews[step.id]}
            alt={`${step.step_number}`}
            className="mt-3 w-full rounded-[1.25rem] object-cover"
          />
        ) : null}
      </div>
    );
  } else if (screen.type === "feedback" && step) {
    const evalStatus = stepStatus[step.id];
    body =
      evalStatus === "invalid" || evalStatus === "skipped" ? (
        <section>
          <p className="text-xs font-medium text-muted">{t("techniquesEvalStep")}</p>
          <p className="mt-1 text-xs text-muted">STEP {step.step_number}</p>
          {step.title ? <h2 className="mt-2 text-2xl font-semibold">{step.title}</h2> : null}
          {previews[step.id] ? (
            <img
              src={previews[step.id]}
              alt={`${step.step_number}`}
              className="mt-3 w-full rounded-[1.25rem] object-cover"
            />
          ) : null}
          <p className="mt-4 text-sm font-medium text-muted">{t("techniquesUnevaluated")}</p>
        </section>
      ) : stepResult ? (
      <section>
        <p className="text-xs font-medium text-muted">{t("techniquesEvalStep")}</p>
        <p className="mt-1 text-xs text-muted">STEP {step.step_number}</p>
        <p className="mt-2 text-xs font-semibold text-accent">
          {stepResult.passed ? t("techniquesPassed") : t("techniquesKeepGoing")}
        </p>
        <h2 className="mt-1 text-2xl font-semibold">{stepResult.headline}</h2>
        {previews[step.id] ? (
          <img
            src={previews[step.id]}
            alt={`${step.step_number}`}
            className="mt-3 w-full rounded-[1.25rem] object-cover"
          />
        ) : null}
        <ul className="mt-4 space-y-2 text-sm">
          {stepResult.items.map((item) => (
            <li key={item.criterion_id}>
              <span className={item.score >= 2 ? "text-accent" : "text-muted"}>
                {item.score >= 2 ? "✓" : "△"} {item.feedback}
              </span>
              {item.is_safety ? (
                <span className="ml-2 text-xs text-red-700">{t("techniquesSafety")}</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">{stepResult.next_practice}</p>
      </section>
    ) : (
      <p className="text-sm text-muted">{saving ? t("techniquesEvaluating") : t("techniquesEvalStep")}</p>
    );
  } else {
    const lastResult = acceptedResults[acceptedResults.length - 1];
    body = (
      <section>
        {summaryScores ? (
          <p className="text-xs font-semibold text-accent">
            {summaryPassed ? t("techniquesPassed") : t("techniquesKeepGoing")}
          </p>
        ) : null}
        <h2 className={`${summaryScores ? "mt-1" : ""} text-2xl font-semibold`}>{t("techniquesSummary")}</h2>
        {lastResult ? <p className="mt-2 text-lg font-semibold">{lastResult.headline}</p> : null}
        <div className="mt-3">
          <ScoreStars scores={summaryScores} animate size="lg" />
        </div>
        <ul className="mt-4 space-y-4 text-sm">
          {detail.steps.map((item) => {
            const result = stepResults[item.id];
            const evalStatus = stepStatus[item.id];
            return (
              <li key={item.id}>
                <p className="font-medium">
                  STEP {item.step_number}
                  {item.title ? ` · ${item.title}` : ""}
                </p>
                {evalStatus === "scored" && result ? (
                  <>
                    <p className="mt-1 text-muted">{result.headline}</p>
                    <ul className="mt-2 space-y-1">
                      {result.items.map((criterion) => (
                        <li key={criterion.criterion_id} className={criterion.score >= 2 ? "text-accent" : "text-muted"}>
                          {criterion.score >= 2 ? "✓" : "△"} {criterion.feedback}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="mt-1 text-muted">{t("techniquesUnevaluated")}</p>
                )}
              </li>
            );
          })}
        </ul>
        {lastResult ? <p className="mt-4 text-sm text-muted">{lastResult.next_practice}</p> : null}

        <h3 className="mt-8 text-lg font-semibold">{t("techniquesRecommend")}</h3>
        {unlearnedRelated.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {unlearnedRelated.map((item, index) => (
              <TechniqueCard
                key={item.id}
                technique={{ ...item, stage_number: index + 1 }}
                status="unlocked"
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">{t("techniquesRelated")}</p>
        )}
        <Link to="/" className="btn-secondary mt-6 w-full">
          {t("techniquesLobby")}
        </Link>
      </section>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-lg flex-col px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {showDots ? <LessonProgress total={detail.steps.length} current={currentStep} /> : null}
      <div className="flex min-h-0 flex-1 items-stretch gap-1">
        <button
          type="button"
          className="stage-orb stage-orb-nav shrink-0 self-center disabled:opacity-40"
          aria-label={t("techniquesPrev")}
          disabled={!canPrev}
          onClick={goBack}
        >
          <ChevronLeft className="h-7 w-7" strokeWidth={2.25} />
        </button>
        <div className="min-w-0 flex-1 overflow-y-auto py-4">{body}</div>
        <button
          type="button"
          className="stage-orb stage-orb-nav shrink-0 self-center disabled:opacity-40"
          aria-label={t("techniquesNext")}
          disabled={!canNext}
          onClick={goForward}
        >
          <ChevronRight className="h-7 w-7" strokeWidth={2.25} />
        </button>
      </div>
      {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
      {screen.type === "summary" ? null : (
        <div className="mb-2 flex gap-2">
          {screen.type === "feedback" ? (
            <button className="btn-secondary min-h-11 flex-1" type="button" disabled={saving} onClick={retryCurrentStep}>
              {t("techniquesRetry")}
            </button>
          ) : null}
          <button
            className="btn-primary min-h-11 flex-1"
            type="button"
            disabled={!canNext || saving}
            onClick={goForward}
          >
            {saving ? t("techniquesEvaluating") : t("techniquesNext")}
          </button>
        </div>
      )}
      {popup ? (
        <ConfirmDialog
          title={popup === "no-photo" ? t("techniquesSkipNoPhoto") : t("techniquesSkipBadPhoto")}
          onClose={() => setPopup(null)}
        />
      ) : null}
      {retryClearedOpen ? (
        <ConfirmDialog
          title={t("techniquesRetryCleared")}
          busy={resettingCleared}
          onConfirm={() => void confirmRetryCleared()}
          onClose={() => {
            if (!resettingCleared) setRetryClearedOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
