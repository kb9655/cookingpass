import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { listTechniques, getTechniqueProgress } from "../services/techniqueService";
import { isSupabaseConfigured } from "../lib/supabase";
import { CardSkeleton } from "../components/common/Feedback";
import type { Technique, TechniqueProgress } from "../types/technique";

export function Home() {
  const { user, profile } = useAuth();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [progress, setProgress] = useState<TechniqueProgress[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    setLoading(true);
    Promise.all([
      listTechniques(),
      user ? getTechniqueProgress(user.id) : Promise.resolve([]),
    ])
      .then(([nextTechniques, nextProgress]) => {
        if (!active) return;
        setTechniques(nextTechniques);
        setProgress(nextProgress);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const cleared = progress.filter((item) => item.status === "cleared").length;
  const total = techniques.length || 7;
  const percent = Math.round((cleared / total) * 100);
  const nextStage =
    techniques.find((technique) => {
      const status = progress.find((item) => item.technique_id === technique.id)?.status;
      return status === "unlocked" || (!user && technique.stage_number === 1);
    }) ?? techniques[0];

  return (
    <main className="page">
      <p className="text-sm font-medium text-accent">Cooking Pass</p>
      <h1 className="mt-2 max-w-[16ch] text-4xl font-semibold leading-[1.1] tracking-tight">
        요리 기술을 스테이지처럼 배웁니다
      </h1>
      <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-muted">
        칼질부터 볶기까지 하나씩 익히고, 지금 가진 재료로 바로 쓸 수 있는 레시피를 받습니다.
      </p>

      {user ? (
        <section className="mt-8 rounded-[1.5rem] bg-accent px-5 py-5 text-white">
          <p className="text-sm text-white/80">{profile?.display_name ?? "요리 학습자"}</p>
          <p className="mt-1 text-2xl font-semibold">{percent}% 완료</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-white/80">
            {cleared}/{total}개 기술 클리어
          </p>
        </section>
      ) : (
        <section className="mt-8 rounded-[1.5rem] border border-line bg-card p-5">
          <h2 className="text-lg font-semibold">데모 레시피로 Claude를 확인해 보세요</h2>
          <p className="mt-2 text-sm text-muted">
            보유 재료는 이 기기에 저장됩니다. 로그인 없이 레시피 단계화·수정·대체를 시험할 수 있습니다.
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/recipes" className="btn-primary">
              레시피 보기
            </Link>
            <Link to="/ingredients" className="btn-secondary">
              재료 등록
            </Link>
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">다음 스테이지</h2>
        {loading ? (
          <div className="mt-3">
            <CardSkeleton />
          </div>
        ) : nextStage ? (
          <Link
            to={`/techniques/${nextStage.id}`}
            className="mt-3 block rounded-[1.5rem] border border-line bg-card p-5"
          >
            <p className="text-xs text-muted">Stage {String(nextStage.stage_number).padStart(2, "0")}</p>
            <p className="mt-1 text-xl font-semibold">{nextStage.name}</p>
            <p className="mt-2 text-sm text-muted">{nextStage.description}</p>
          </Link>
        ) : (
          <p className="mt-3 text-sm text-muted">스테이지 데이터를 불러오지 못했습니다.</p>
        )}
      </section>
    </main>
  );
}
