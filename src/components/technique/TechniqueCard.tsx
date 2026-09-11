import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocale } from "../../i18n/locale";
import type { Technique, TechniqueProgressStatus } from "../../types/technique";
import { ScoreStars } from "./ScoreStars";

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

  return (
    <Link to={`/techniques/${technique.id}`}>
      <article className="relative flex aspect-square flex-col justify-between rounded-[1.5rem] border border-line bg-card p-3">
        {cleared ? (
          <span className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white">
            <Check className="h-4 w-4" strokeWidth={2.25} />
            <span className="sr-only">{t("techniquesCleared")}</span>
          </span>
        ) : null}
        <p className="text-xs font-medium text-muted">
          {String(technique.stage_number).padStart(2, "0")}
        </p>
        <div>
          <h2 className="text-base font-semibold leading-snug">{technique.name}</h2>
          <div className="mt-2">
            <ScoreStars scores={scores} label={t("techniquesScoreLabel")} />
          </div>
        </div>
      </article>
    </Link>
  );
}
