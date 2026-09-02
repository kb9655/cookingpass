import { Lightbulb } from "lucide-react";
import { MediaSlot } from "../common/MediaSlot";
import type { AdjustedStep } from "../../types/recipe";

export function CookingStep({
  step,
  techniqueName,
  recipeTitle,
}: {
  step: AdjustedStep;
  techniqueName?: string;
  recipeTitle: string;
}) {
  return (
    <section>
      <p className="text-lg leading-relaxed">{step.instruction}</p>
      <div className="mt-6">
        <MediaSlot label={`${recipeTitle} ${step.step}단계`} />
      </div>
      {techniqueName ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-accent">
          <Lightbulb className="h-4 w-4" strokeWidth={1.75} />
          {techniqueName} 기술
        </p>
      ) : null}
      {step.ingredients?.length ? (
        <p className="mt-3 text-sm text-muted">재료: {step.ingredients.join(", ")}</p>
      ) : null}
      {step.tools?.length ? (
        <p className="mt-1 text-sm text-muted">도구: {step.tools.join(", ")}</p>
      ) : null}
      {step.time_minutes ? (
        <p className="mt-1 text-sm text-muted">시간: 약 {step.time_minutes}분</p>
      ) : null}
      {step.temperature ? (
        <p className="mt-1 text-sm text-muted">온도: {step.temperature}</p>
      ) : null}
      {step.warnings?.length ? (
        <p className="mt-3 text-sm text-red-700">{step.warnings.join(" ")}</p>
      ) : null}
    </section>
  );
}
