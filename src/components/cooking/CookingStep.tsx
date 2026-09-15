import { Lightbulb } from "lucide-react";
import type { AdjustedStep } from "../../types/recipe";
import { StepTimer } from "./StepTimer";

export function CookingStep({
  step,
  techniqueName,
}: {
  step: AdjustedStep;
  techniqueName?: string;
}) {
  const timed = typeof step.time_minutes === "number" && step.time_minutes > 0;

  return (
    <section>
      <p className="text-lg leading-relaxed">{step.instruction}</p>
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
      {timed ? <StepTimer key={step.step} minutes={step.time_minutes as number} /> : null}
      {step.temperature ? (
        <p className="mt-1 text-sm text-muted">온도: {step.temperature}</p>
      ) : null}
      {step.warnings?.length ? (
        <p className="mt-3 text-sm text-red-700">{step.warnings.join(" ")}</p>
      ) : null}
    </section>
  );
}
