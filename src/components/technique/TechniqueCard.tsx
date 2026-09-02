import { Check, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import type { Technique, TechniqueProgressStatus } from "../../types/technique";
import { StarRating } from "../common/StarRating";

export function TechniqueCard({
  technique,
  status,
}: {
  technique: Technique;
  status: TechniqueProgressStatus;
}) {
  const locked = status === "locked";
  const content = (
    <article
      className={`rounded-[1.5rem] border bg-card p-4 ${
        locked ? "border-line opacity-70" : "border-line"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">
          Stage {String(technique.stage_number).padStart(2, "0")}
        </span>
        {status === "cleared" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
            CLEAR
          </span>
        ) : status === "locked" ? (
          <Lock className="h-4 w-4 text-muted" strokeWidth={1.75} />
        ) : (
          <span className="text-xs text-muted">미클리어</span>
        )}
      </div>
      <h2 className="text-lg font-semibold">{technique.name}</h2>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{technique.description}</p>
      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <StarRating value={technique.difficulty} />
        <span>약 {technique.estimated_minutes}분</span>
      </div>
    </article>
  );

  if (locked) {
    return content;
  }

  return <Link to={`/techniques/${technique.id}`}>{content}</Link>;
}
