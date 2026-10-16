import { formatTimerClock, type WaitTimer } from "../../lib/cookTimer";
import { useLocale } from "../../i18n/locale";

function TimerDockRow({
  timer,
  active,
  onOpenStep,
}: {
  timer: WaitTimer;
  active: boolean;
  onOpenStep: (stepIndex: number) => void;
}) {
  const { t } = useLocale();
  const ratio = timer.totalMs <= 0 ? 0 : Math.max(0, Math.min(1, timer.remainingMs / timer.totalMs));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - ratio);
  const label = timer.label
    ? t("cookTimerDockStepNamed", { n: timer.stepNumber, name: timer.label })
    : t("cookTimerDockStep", { n: timer.stepNumber });

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 rounded-[1.25rem] border bg-card px-3 py-2 text-left shadow-sm ${
        active ? "border-accent" : "border-accent/30"
      }`}
      onClick={() => onOpenStep(timer.stepIndex)}
      aria-label={t("cookTimerDockOpen")}
    >
      <svg className="size-12 shrink-0 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={radius} fill="none" className="stroke-line" strokeWidth="6" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          className="stroke-accent"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-muted">{label}</span>
        <span className="block text-2xl font-black tabular-nums tracking-tight">
          {timer.done ? t("cookTimerDone") : formatTimerClock(timer.remainingMs)}
        </span>
      </span>
    </button>
  );
}

export function CookingTimerDock({
  timers,
  activeStepIndex,
  onOpenStep,
}: {
  timers: WaitTimer[];
  activeStepIndex: number;
  onOpenStep: (stepIndex: number) => void;
}) {
  if (!timers.length) return null;

  return (
    <div className="mb-2 flex max-h-44 flex-col gap-2 overflow-y-auto">
      {timers.map((timer) => (
        <TimerDockRow
          key={timer.stepIndex}
          timer={timer}
          active={timer.stepIndex === activeStepIndex}
          onOpenStep={onOpenStep}
        />
      ))}
    </div>
  );
}
