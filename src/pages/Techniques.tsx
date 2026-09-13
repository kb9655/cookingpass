import { useEffect, useMemo, useState } from "react";
import { TechniqueCard } from "../components/technique/TechniqueCard";
import { EmptyState, ErrorState, PageLoader } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { isSupabaseConfigured } from "../lib/supabase";
import {
  getTechniqueProgress,
  listChildTechniquesByParents,
  listTechniques,
  scoresForTechnique,
} from "../services/techniqueService";
import type { Technique, TechniqueProgress, TechniqueProgressStatus } from "../types/technique";

export function Techniques() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [progress, setProgress] = useState<TechniqueProgress[]>([]);
  const [childIdsByParent, setChildIdsByParent] = useState<Record<string, string[]>>({});
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
      .then(async ([nextTechniques, nextProgress]) => {
        const children = await listChildTechniquesByParents(nextTechniques.map((item) => item.id));
        const nextChildren: Record<string, string[]> = {};
        for (const child of children) {
          if (!child.parent_id) continue;
          nextChildren[child.parent_id] = [...(nextChildren[child.parent_id] ?? []), child.id];
        }
        setTechniques(nextTechniques);
        setChildIdsByParent(nextChildren);
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

  const currentId = techniques.find((item) => (statusById.get(item.id) ?? "unlocked") !== "cleared")?.id;
  const pathAlign = ["justify-center", "justify-start pl-2", "justify-end pr-2", "justify-center"];

  return (
    <main className="page">
      <h1 className="text-3xl font-black tracking-tight">{t("techniquesTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("techniquesLead")}</p>
      {error ? <div className="mt-6"><ErrorState message={error} onRetry={load} /></div> : null}
      {!isSupabaseConfigured ? (
        <div className="mt-8">
          <EmptyState
            title="데이터베이스가 연결되지 않았습니다"
            body=".env에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 넣은 뒤 시드 SQL을 적용하세요."
          />
        </div>
      ) : loading ? (
        <PageLoader label={t("pageLoading")} />
      ) : (
        <div className="relative mx-auto mt-10 max-w-sm">
          <div className="path-rail absolute top-10 bottom-10 left-1/2 w-2 -translate-x-1/2 rounded-full" />
          <div className="relative z-10 space-y-8">
            {techniques.map((technique, index) => {
              const status = statusById.get(technique.id) ?? "unlocked";
              return (
                <div key={technique.id} className={`flex ${pathAlign[index % pathAlign.length]}`}>
                  <TechniqueCard
                    technique={technique}
                    status={status}
                    current={technique.id === currentId}
                    scores={scoresForTechnique(technique.id, childIdsByParent[technique.id] ?? [], progress)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
