import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MediaSlot } from "../components/common/MediaSlot";
import { ErrorState, Skeleton } from "../components/common/Feedback";
import { StarRating } from "../components/common/StarRating";
import { useAuth } from "../hooks/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import { getTechniqueDetail, getTechniqueProgress, markCleared } from "../services/techniqueService";
import type { TechniqueDetail, TechniqueProgressStatus } from "../types/technique";

export function TechniqueDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [detail, setDetail] = useState<TechniqueDetail | null>(null);
  const [status, setStatus] = useState<TechniqueProgressStatus>("unlocked");
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
    Promise.all([
      getTechniqueDetail(id),
      user ? getTechniqueProgress(user.id) : Promise.resolve([]),
    ])
      .then(([next, progress]) => {
        if (!active) return;
        setDetail(next);
        const found = progress.find((item) => item.technique_id === id);
        setStatus(found?.status ?? (next?.stage_number === 1 ? "unlocked" : "locked"));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "학습 자료를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, user]);

  async function onClear() {
    if (!user) {
      navigate("/login", { state: { from: `/techniques/${id}` } });
      return;
    }
    setSaving(true);
    setError("");
    try {
      await markCleared(user.id, id);
      setStatus("cleared");
      navigate(`/recipes?technique=${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "클리어 저장에 실패했습니다.");
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
        <ErrorState message="해당 스테이지를 찾을 수 없습니다." />
      </main>
    );
  }

  return (
    <main className="page pb-8">
      <p className="text-sm text-muted">Stage {String(detail.stage_number).padStart(2, "0")}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{detail.name}</h1>
      <div className="mt-3 flex items-center gap-3 text-sm text-muted">
        <StarRating value={detail.difficulty} />
        <span>약 {detail.estimated_minutes}분</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{detail.description}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">학습 목표</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {detail.learning_goals.map((goal) => (
            <li key={goal}>{goal}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">필요한 도구</h2>
        <p className="mt-2 text-sm text-muted">{detail.required_tools.join(", ")}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">주의사항</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {detail.precautions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-8 space-y-6">
        <h2 className="text-lg font-semibold">단계별 설명</h2>
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
          </article>
        ))}
      </section>

      {detail.related.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">연관 기술</h2>
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
          <h2 className="text-lg font-semibold">이 기술을 쓰는 레시피</h2>
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

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {status === "cleared" ? (
        <p className="mt-8 text-sm font-semibold text-accent">이 스테이지는 클리어했습니다.</p>
      ) : status === "locked" ? (
        <p className="mt-8 text-sm text-muted">이전 스테이지를 먼저 클리어하세요.</p>
      ) : (
        <button className="btn-primary mt-8 w-full" type="button" onClick={onClear} disabled={saving}>
          {saving ? "저장 중" : "학습 완료"}
        </button>
      )}
    </main>
  );
}
