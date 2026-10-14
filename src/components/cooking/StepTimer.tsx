import { formatTimerClock } from "../../lib/cookTimer";
import { useLocale } from "../../i18n/locale";

export function StepTimer({
  minutes,
  remainingMs,
  running,
  done,
  onStart,
  onPause,
  onReset,
}: {
  minutes: number;
  remainingMs: number;
  running: boolean;
  done: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  const { t } = useLocale();

  return (
    <div className="mt-4 rounded-[1.25rem] border border-line bg-card p-4">
      <p className="text-lg text-muted">{t("cookTimerLabel", { n: minutes })}</p>
      <p className="mt-2 text-center text-6xl font-black tabular-nums tracking-tight">
        {formatTimerClock(remainingMs)}
      </p>
      {done ? <p className="mt-2 text-center text-2xl font-medium text-accent">{t("cookTimerDone")}</p> : null}
      <div className="mt-4 grid grid-cols-3 gap-1 min-[380px]:gap-2">
        <button
          type="button"
          className="btn-primary min-h-12 min-w-0 px-2 text-base"
          onClick={onStart}
          disabled={running}
        >
          {t("cookTimerStart")}
        </button>
        <button
          type="button"
          className="btn-secondary min-h-12 min-w-0 px-2 text-base"
          onClick={onPause}
          disabled={!running}
        >
          {t("cookTimerPause")}
        </button>
        <button
          type="button"
          className="btn-secondary min-h-12 min-w-0 px-2 text-base"
          onClick={onReset}
        >
          {t("cookTimerReset")}
        </button>
      </div>
      {typeof Notification !== "undefined" && Notification.permission !== "granted" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">{t("cookTimerPermissionHint")}</p>
      ) : null}
    </div>
  );
}
