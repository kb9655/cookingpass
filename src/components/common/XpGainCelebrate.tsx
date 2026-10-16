import { useEffect, useState } from "react";
import { useLocale } from "../../i18n/locale";

export function XpGainCelebrate({
  gainedXp,
  fromPercent,
  toPercent,
  fromLevel,
  toLevel,
  animate,
}: {
  gainedXp: number;
  fromPercent: number;
  toPercent: number;
  fromLevel: number;
  toLevel: number;
  animate: boolean;
}) {
  const { t } = useLocale();
  const leveled = toLevel > fromLevel;
  const [bar, setBar] = useState(fromPercent);
  const [showLevel, setShowLevel] = useState(false);

  useEffect(() => {
    if (!animate) {
      setBar(fromPercent);
      setShowLevel(false);
      return;
    }
    setBar(fromPercent);
    setShowLevel(false);
    let cancelled = false;
    const fill = window.setTimeout(() => {
      if (cancelled) return;
      setBar(leveled ? 100 : toPercent);
    }, 80);
    const wrap = leveled
      ? window.setTimeout(() => {
          if (cancelled) return;
          setShowLevel(true);
          setBar(0);
        }, 720)
      : undefined;
    const rest = leveled
      ? window.setTimeout(() => {
          if (cancelled) return;
          setBar(toPercent);
        }, 800)
      : undefined;
    return () => {
      cancelled = true;
      window.clearTimeout(fill);
      if (wrap != null) window.clearTimeout(wrap);
      if (rest != null) window.clearTimeout(rest);
    };
  }, [animate, fromPercent, toPercent, leveled]);

  return (
    <div className="xp-celebrate relative mt-4 overflow-hidden rounded-[1.5rem] border border-accent/30 bg-card p-4">
      {leveled && showLevel ? <div className="xp-sparkles" aria-hidden="true" /> : null}
      <p className="xp-pop text-center text-4xl font-black text-accent">{t("cookSummaryXp", { n: gainedXp })}</p>
      {leveled && showLevel ? (
        <p className="xp-level-banner mt-2 text-center text-2xl font-black tracking-tight text-accent">
          {t("cookSummaryLevelUp", { n: toLevel })}
        </p>
      ) : (
        <p className="mt-2 text-center text-sm font-bold text-muted">{t("profileLevel", { n: fromLevel })}</p>
      )}
      <div className={`mt-3 h-3 overflow-hidden rounded-full bg-line ${animate ? "xp-bar-glow" : ""}`}>
        <div className="progress-fill h-full bg-accent" style={{ width: `${bar}%` }} />
      </div>
    </div>
  );
}
