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
        <div className="mt-8 grid grid-cols-3 gap-x-2 gap-y-8">
          {techniques.map((technique) => {
            const status = statusById.get(technique.id) ?? "unlocked";
            return (
              <TechniqueCard
                key={technique.id}
                technique={technique}
                status={status}
                current={technique.id === currentId}
                scores={scoresForTechnique(technique.id, childIdsByParent[technique.id] ?? [], progress)}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}
