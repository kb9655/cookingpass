import { useEffect, useMemo, useState } from "react";
import { TechniqueCard } from "../components/technique/TechniqueCard";
import { CardSkeleton, EmptyState, ErrorState } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { isSupabaseConfigured } from "../lib/supabase";
import { getTechniqueProgress, listTechniques } from "../services/techniqueService";
import type { Technique, TechniqueProgress, TechniqueProgressStatus } from "../types/technique";

export function Techniques() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [progress, setProgress] = useState<TechniqueProgress[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);

  function load() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    Promise.all([
      listTechniques(),
      user ? getTechniqueProgress(user.id) : Promise.resolve([]),
    ])
      .then(([nextTechniques, nextProgress]) => {
        setTechniques(nextTechniques);
        setProgress(nextProgress);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("techniquesLoadError"));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const statusById = useMemo(() => {
    const map = new Map<string, TechniqueProgressStatus>();
    for (const item of progress) map.set(item.technique_id, item.status);
    return map;
  }, [progress]);

  return (
    <main className="page">
      <h1 className="text-3xl font-semibold tracking-tight">{t("techniquesTitle")}</h1>
      <p className="mt-2 text-sm text-muted">한 스테이지씩 익히고 클리어하세요.</p>
      {error ? <div className="mt-6"><ErrorState message={error} onRetry={load} /></div> : null}
      <div className="mt-6 grid gap-3">
        {!isSupabaseConfigured ? (
          <EmptyState
            title="데이터베이스가 연결되지 않았습니다"
            body=".env에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣은 뒤 시드 SQL을 적용하세요."
          />
        ) : loading
          ? Array.from({ length: 4 }, (_, index) => <CardSkeleton key={index} />)
          : techniques.map((technique) => (
              <TechniqueCard
                key={technique.id}
                technique={technique}
                status={
                  statusById.get(technique.id) ??
                  (technique.stage_number === 1 ? "unlocked" : "locked")
                }
              />
            ))}
      </div>
    </main>
  );
}
