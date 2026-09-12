import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLocale } from "../../i18n/locale";
import type { Technique, TechniqueProgressStatus } from "../../types/technique";
import { ScoreStars } from "./ScoreStars";
import { TechniqueIcon } from "./techniqueIcon";

function scoresKey(techniqueId: string) {
  return `cookingpass:seen-scores:${techniqueId}`;
}

export function TechniqueCard({
  technique,
  status,
  scores,
}: {
  technique: Technique;
  status: TechniqueProgressStatus;
  scores?: number[] | null;
}) {
  const { t } = useLocale();
  const cleared = status === "cleared";
  const signature = JSON.stringify(scores ?? []);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!scores?.some((score) => score != null)) return;
    const seen = sessionStorage.getItem(scoresKey(technique.id));
    if (seen === signature) return;
    setAnimate(true);
    sessionStorage.setItem(scoresKey(technique.id), signature);
  }, [technique.id, scores, signature]);

  return (
    <Link to={`/techniques/${technique.id}`} className="flex flex-col items-center gap-2 px-1 py-2">
      <span className={`stage-tile ${cleared ? "stage-tile-clear" : ""}`}>
        <TechniqueIcon slug={technique.slug} className="size-8" />
        <span className="sr-only">{cleared ? t("techniquesCleared") : technique.name}</span>
      </span>
      <h2 className="text-center text-sm font-bold leading-snug">{technique.name}</h2>
      <ScoreStars scores={scores} label={t("techniquesScoreLabel")} animate={animate} />
    </Link>
  );
}
