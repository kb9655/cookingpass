import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { listTechniques, getTechniqueProgress } from "../services/techniqueService";
import { isSupabaseConfigured } from "../lib/supabase";
import { CardSkeleton } from "../components/common/Feedback";
import type { Technique, TechniqueProgress } from "../types/technique";

export function Home() {
  const { user, profile } = useAuth();
  const { t } = useLocale();
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
      <p className="text-sm font-medium text-accent">{t("homeEyebrow")}</p>
      <h1 className="mt-2 max-w-[16ch] text-4xl font-semibold leading-[1.1] tracking-tight">
        {t("homeTitle")}
      </h1>
      <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-muted">{t("homeLead")}</p>

      <section className="mt-8 rounded-[1.5rem] bg-accent px-5 py-5 text-white">
        <p className="text-sm text-white/80">{profile?.display_name ?? t("homeLearner")}</p>
        <p className="mt-1 text-2xl font-semibold">
          {percent}% {t("homeComplete")}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-sm text-white/80">
          {cleared}/{total} {t("homeCleared")}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("homeNextStage")}</h2>
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
          <p className="mt-3 text-sm text-muted">{t("homeNoStage")}</p>
        )}
      </section>
    </main>
  );
}
