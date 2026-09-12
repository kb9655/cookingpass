import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { getTechniqueDetail, getTechniqueProgress, saveTechniqueScores } from "../services/techniqueService";
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
  | { type: "explain"; stepIndex: number }
  | { type: "upload"; stepIndex: number }
  | { type: "feedback"; stepIndex: number }
  | { type: "summary" };

function buildScreens(stepCount: number): WizardScreen[] {
  const screens: WizardScreen[] = [{ type: "intro" }, { type: "caution" }];
  for (let index = 0; index < stepCount; index += 1) {
    screens.push({ type: "explain", stepIndex: index });
    screens.push({ type: "upload", stepIndex: index });
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [screenIndex, setScreenIndex] = useState(0);
  const evaluateStarted = useRef<Record<string, boolean>>({});
  const progressSaved = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setStepResults({});
    setPhotos({});
    setPreviews({});
    setScreenIndex(0);
    evaluateStarted.current = {};
    progressSaved.current = false;
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
    if (from.type === "upload" && detail) {
      return stepHasPhoto(detail.steps[from.stepIndex]);
    }
    if (from.type === "feedback" && detail) {
      return Boolean(stepResults[detail.steps[from.stepIndex]?.id]);
    }
    return true;
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
    if (!step || stepResults[step.id] || evaluateStarted.current[step.id]) return;
    evaluateStarted.current[step.id] = true;
    void runEvaluateStep(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, detail, stepResults]);

  const acceptedResults = useMemo(() => {
    if (!detail) return [];
    return detail.steps
      .map((step) => stepResults[step.id])
      .filter((item): item is TechniqueEvaluation => Boolean(item));
  }, [detail, stepResults]);

  const summaryScores = useMemo(() => aggregateScores(acceptedResults), [acceptedResults]);
  const summaryPassed = useMemo(
    () => (detail ? passedFromScores(detail.criteria, summaryScores) : false),
    [detail, summaryScores],
  );

  useEffect(() => {
    if (screen.type !== "summary" || !detail || !user || progressSaved.current) return;
    if (acceptedResults.length !== detail.steps.length || detail.steps.length === 0) return;
    progressSaved.current = true;
    void saveTechniqueScores(user.id, detail.id, summaryScores, summaryPassed, detail.parent_id)
      .then(() => {
        if (summaryPassed) setStatus("cleared");
      })
      .catch(() => {
        progressSaved.current = false;
        setError(t("techniquesEvalFailed"));
      });
  }, [screen.type, detail, user, acceptedResults.length, summaryScores, summaryPassed, t]);

  function goTo(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= screens.length) return;
    if (nextIndex > screenIndex && !canLeave(screen)) {
      setError(screen.type === "upload" ? t("techniquesNeedPhoto") : t("techniquesEvaluating"));
      return;
    }
    setError("");
    setScreenIndex(nextIndex);
  }

  function retryCurrentStep() {
    if (!detail || screen.type !== "feedback") return;
    const step = detail.steps[screen.stepIndex];
    if (!step) return;
    evaluateStarted.current[step.id] = false;
    setStepResults((current) => {
      const next = { ...current };
      delete next[step.id];
      return next;
    });
    onPickPhoto(step.id, null);
    const uploadIndex = screens.findIndex(
      (item) => item.type === "upload" && item.stepIndex === screen.stepIndex,
    );
    setError("");
    if (uploadIndex >= 0) setScreenIndex(uploadIndex);
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
          <div className="mt-4 grid grid-cols-2 gap-3">
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
    screen.type === "explain" || screen.type === "upload" || screen.type === "feedback"
      ? detail.steps[screen.stepIndex]
      : undefined;
  const showDots = screen.type === "explain" || screen.type === "upload" || screen.type === "feedback";
  const currentStep =
    screen.type === "explain" || screen.type === "upload" || screen.type === "feedback" ? screen.stepIndex : 0;
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
  } else if (screen.type === "explain" && step) {
    body = (
      <div>
        <p className="text-xs font-medium text-muted">{t("techniquesExplainStep")}</p>
        <p className="mt-1 text-xs text-muted">STEP {step.step_number}</p>
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
      </div>
    );
  } else if (screen.type === "upload" && step) {
    body = (
      <div>
        <p className="text-xs font-medium text-muted">{t("techniquesUploadStep")}</p>
        <p className="mt-1 text-xs text-muted">STEP {step.step_number}</p>
        {step.title ? <h2 className="mt-2 text-2xl font-semibold">{step.title}</h2> : null}
        <label className="mt-4 block">
          <span className="text-sm font-medium">{t("techniquesUpload")}</span>
          <input
            className="mt-2 block min-h-11 w-full text-base"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => onPickPhoto(step.id, event.target.files?.[0] ?? null)}
          />
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
    body = stepResult ? (
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
        <p className="text-xs font-semibold text-accent">
          {summaryPassed ? t("techniquesPassed") : t("techniquesKeepGoing")}
        </p>
        <h2 className="mt-1 text-2xl font-semibold">{t("techniquesSummary")}</h2>
        {lastResult ? <p className="mt-2 text-lg font-semibold">{lastResult.headline}</p> : null}
        <div className="mt-3">
          <ScoreStars scores={summaryScores} animate />
        </div>
        <ul className="mt-4 space-y-4 text-sm">
          {detail.steps.map((item) => {
            const result = stepResults[item.id];
            if (!result) return null;
            return (
              <li key={item.id}>
                <p className="font-medium">
                  STEP {item.step_number}
                  {item.title ? ` · ${item.title}` : ""}
                </p>
                <p className="mt-1 text-muted">{result.headline}</p>
                <ul className="mt-2 space-y-1">
                  {result.items.map((criterion) => (
                    <li key={criterion.criterion_id} className={criterion.score >= 2 ? "text-accent" : "text-muted"}>
                      {criterion.score >= 2 ? "✓" : "△"} {criterion.feedback}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
        {lastResult ? <p className="mt-4 text-sm text-muted">{lastResult.next_practice}</p> : null}

        <h3 className="mt-8 text-lg font-semibold">{t("techniquesRecommend")}</h3>
        {unlearnedRelated.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
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
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      {showDots ? <LessonProgress total={detail.steps.length} current={currentStep} /> : null}
      <div className="flex min-h-0 flex-1 items-stretch gap-1">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-center text-ink disabled:text-line"
          aria-label={t("techniquesPrev")}
          disabled={!canPrev}
          onClick={() => goTo(screenIndex - 1)}
        >
          <ChevronLeft className="h-8 w-8" strokeWidth={2} />
        </button>
        <div className="min-w-0 flex-1 overflow-y-auto py-4">{body}</div>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center self-center text-ink disabled:text-line"
          aria-label={t("techniquesNext")}
          disabled={!canNext}
          onClick={() => goTo(screenIndex + 1)}
        >
          <ChevronRight className="h-8 w-8" strokeWidth={2} />
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
            onClick={() => goTo(screenIndex + 1)}
          >
            {saving ? t("techniquesEvaluating") : t("techniquesNext")}
          </button>
        </div>
      )}
    </main>
  );
}
