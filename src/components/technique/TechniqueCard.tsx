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
  current,
  scores,
}: {
  technique: Technique;
  status: TechniqueProgressStatus;
  current?: boolean;
  scores?: number[] | null;
}) {
  const { t } = useLocale();
  const cleared = status === "cleared";
  const locked = status === "locked";
  const signature = JSON.stringify(scores ?? []);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!scores?.some((score) => score != null)) return;
    const seen = sessionStorage.getItem(scoresKey(technique.id));
    if (seen === signature) return;
    setAnimate(true);
    sessionStorage.setItem(scoresKey(technique.id), signature);
  }, [technique.id, scores, signature]);

  const tileClass = [
    "stage-tile",
    cleared ? "stage-tile-clear" : "",
    current ? "stage-tile-current" : "",
    locked ? "stage-tile-locked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/techniques/${technique.id}`} className="flex min-w-0 w-full flex-col items-center gap-2 px-0.5">
      <span className="relative flex flex-col items-center">
        <span className={tileClass}>
          <TechniqueIcon slug={technique.slug} className="size-8" />
          <span className="sr-only">{cleared ? t("techniquesCleared") : technique.name}</span>
        </span>
        <span className="stage-tile-score">
          <ScoreStars scores={scores} label={t("techniquesScoreLabel")} animate={animate} />
        </span>
      </span>
      <h2 className="w-full text-center text-xs font-black leading-snug break-keep sm:text-sm">{technique.name}</h2>
    </Link>
  );
}
