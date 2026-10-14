import { Lightbulb } from "lucide-react";
import type { AdjustedStep } from "../../types/recipe";
import { useMeasure } from "../../i18n/measure";
import { localizeInstruction } from "../../lib/formatMeasure";
import { minutesToMs, type WaitTimer } from "../../lib/cookTimer";
import { StepTimer } from "./StepTimer";

export function CookingStep({
  step,
  techniqueName,
  waitTimer,
  onTimerStart,
  onTimerPause,
  onTimerReset,
}: {
  step: AdjustedStep;
  techniqueName?: string;
  waitTimer: WaitTimer | null;
  onTimerStart: () => void;
  onTimerPause: () => void;
  onTimerReset: () => void;
}) {
  const { prefs } = useMeasure();
  const timed = typeof step.time_minutes === "number" && step.time_minutes > 0;
  const bound = waitTimer != null;
  const remainingMs = bound ? waitTimer.remainingMs : minutesToMs(step.time_minutes ?? 0);

  return (
    <section>
      <p className="text-2xl font-medium leading-snug break-keep">{localizeInstruction(step.instruction, prefs)}</p>
      {techniqueName ? (
        <p className="mt-4 inline-flex items-center gap-2 text-lg text-accent">
          <Lightbulb className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          {techniqueName} 기술
        </p>
      ) : null}
      {step.ingredients?.length ? (
        <p className="mt-3 text-lg text-ink">재료: {step.ingredients.join(", ")}</p>
      ) : null}
      {step.tools?.length ? (
        <p className="mt-1 text-lg text-ink">도구: {step.tools.join(", ")}</p>
      ) : null}
      {timed ? (
        <StepTimer
          minutes={step.time_minutes as number}
          remainingMs={remainingMs}
          running={bound ? waitTimer.running : false}
          done={bound ? waitTimer.done : false}
          onStart={onTimerStart}
          onPause={onTimerPause}
          onReset={onTimerReset}
        />
      ) : null}
      {step.temperature ? (
        <p className="mt-3 text-lg text-ink">온도: {step.temperature}</p>
      ) : null}
      {step.warnings?.length ? (
        <p className="mt-3 text-lg font-medium text-red-700">{step.warnings.join(" ")}</p>
      ) : null}
    </section>
  );
}
