import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MediaSlot } from "../components/common/MediaSlot";
import { ErrorState, Skeleton } from "../components/common/Feedback";
import { StarRating } from "../components/common/StarRating";
import { ScoreStars } from "../components/technique/ScoreStars";
import { TechniqueCard } from "../components/technique/TechniqueCard";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { ApiError, evaluateTechnique } from "../lib/api";
import { fileToJpegBase64 } from "../lib/compressImage";
import { isSupabaseConfigured } from "../lib/supabase";
import { getTechniqueDetail, getTechniqueProgress } from "../services/techniqueService";
import type {
  TechniqueDetail,
  TechniqueEvaluation,
  TechniqueProgress,
  TechniqueProgressStatus,
} from "../types/technique";

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
  const [result, setResult] = useState<TechniqueEvaluation | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    setResult(null);
    setPhotos({});
    setPreviews({});
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

  async function onEvaluate() {
    if (!detail) return;
    if (!user) {
      navigate("/login", { state: { from: `/techniques/${id}` } });
      return;
    }
    const missing = detail.steps.filter((step) => !photos[step.id]);
    if (missing.length > 0) {
      setError(t("techniquesNeedPhotos"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const encoded = await Promise.all(
        detail.steps.map(async (step) => {
          const file = photos[step.id];
          if (!file) throw new Error(t("techniquesNeedPhotos"));
          const jpeg = await fileToJpegBase64(file);
          return { step_number: step.step_number, ...jpeg };
        }),
      );
      const next = await evaluateTechnique({ techniqueId: detail.id, photos: encoded });
      setResult(next);
      if (next.passed) setStatus("cleared");
    } catch (err) {
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

  return (
    <main className="page pb-8">
      <p className="text-sm text-muted">Stage {String(detail.stage_number > 70 ? 7 : detail.stage_number).padStart(2, "0")}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{detail.name}</h1>
      <div className="mt-3 flex items-center gap-3 text-sm text-muted">
        <StarRating value={detail.difficulty} />
        <span>약 {detail.estimated_minutes}분</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{detail.description}</p>

      {isParent ? (
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
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("techniquesGoals")}</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {detail.learning_goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t("techniquesTools")}</h2>
        <p className="mt-2 text-sm text-muted">{detail.required_tools.join(", ")}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t("techniquesPrecautions")}</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {detail.precautions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {!isParent ? (
        <section className="mt-8 space-y-6">
          <h2 className="text-lg font-semibold">{t("techniquesSteps")}</h2>
          {detail.capture_hint ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-muted">
              {detail.capture_hint}
            </p>
          ) : null}
          {detail.target_size ? (
            <p className="text-sm text-muted">{t("techniquesTargetSize", { size: detail.target_size })}</p>
          ) : null}
          {detail.steps.map((step) => (
            <article key={step.id} className="rounded-[1.5rem] border border-line bg-card p-4">
              <p className="text-xs font-medium text-muted">STEP {step.step_number}</p>
              {step.title ? <h3 className="mt-1 font-semibold">{step.title}</h3> : null}
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.instruction}</p>
              <div className="mt-4">
                <MediaSlot
                  media={step.media}
                  label={step.title ?? `${detail.name} ${step.step_number}단계`}
                />
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-medium">{t("techniquesUpload")}</span>
                <input
                  className="mt-2 block w-full text-sm"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => onPickPhoto(step.id, event.target.files?.[0] ?? null)}
                />
              </label>
              {previews[step.id] ? (
                <img
                  src={previews[step.id]}
                  alt={`${step.step_number}단계 연습 사진`}
                  className="mt-3 w-full rounded-[1.25rem] object-cover"
                />
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {detail.related.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("techniquesRelated")}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.related.map((item) => (
              <Link
                key={item.id}
                to={`/techniques/${item.id}`}
                className="rounded-full border border-line bg-card px-3 py-1 text-sm"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {detail.recipes.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("techniquesRecipes")}</h2>
          <div className="mt-3 grid gap-2">
            {detail.recipes.map((recipe) => (
              <Link
                key={recipe.id}
                to={`/recipes/${recipe.id}`}
                className="rounded-2xl border border-line bg-card px-4 py-3 text-sm font-medium"
              >
                {recipe.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {result ? (
        <section className="mt-8 rounded-[1.5rem] border border-line bg-card p-5">
          <p className="text-xs font-semibold text-accent">
            {result.passed ? t("techniquesPassed") : t("techniquesKeepGoing")}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{result.headline}</h2>
          <div className="mt-3">
            <ScoreStars scores={result.last_item_scores} />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {result.items.map((item) => (
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
          <p className="mt-4 text-sm text-muted">{result.next_practice}</p>
        </section>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {!isParent ? (
        <button className="btn-primary mt-8 w-full" type="button" onClick={onEvaluate} disabled={saving}>
          {saving ? t("techniquesEvaluating") : t("techniquesEvaluate")}
        </button>
      ) : null}

      {status === "cleared" && !result ? (
        <p className="mt-6 text-sm font-semibold text-accent">{t("techniquesAlreadyCleared")}</p>
      ) : null}
    </main>
  );
}
