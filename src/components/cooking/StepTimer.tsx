import { useEffect, useRef, useState } from "react";
import { useLocale } from "../../i18n/locale";

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function StepTimer({ minutes }: { minutes: number }) {
  const { t } = useLocale();
  const totalMs = Math.max(0, Math.round(minutes * 60 * 1000));
  const [remainingMs, setRemainingMs] = useState(totalMs);
  const [running, setRunning] = useState(false);
  const endAtRef = useRef<number | null>(null);

  useEffect(() => {
    setRemainingMs(totalMs);
    setRunning(false);
    endAtRef.current = null;
  }, [totalMs]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const endAt = endAtRef.current;
      if (endAt == null) return;
      const next = Math.max(0, endAt - Date.now());
      setRemainingMs(next);
      if (next <= 0) {
        setRunning(false);
        endAtRef.current = null;
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running]);

  function start() {
    const left = remainingMs > 0 ? remainingMs : totalMs;
    if (remainingMs <= 0) setRemainingMs(totalMs);
    endAtRef.current = Date.now() + left;
    setRunning(true);
  }

  function pause() {
    if (endAtRef.current != null) {
      setRemainingMs(Math.max(0, endAtRef.current - Date.now()));
    }
    endAtRef.current = null;
    setRunning(false);
  }

  function reset() {
    endAtRef.current = null;
    setRunning(false);
    setRemainingMs(totalMs);
  }

  const done = remainingMs <= 0;

  return (
    <div className="mt-4 rounded-[1.25rem] border border-line bg-card p-4">
      <p className="text-xs text-muted">{t("cookTimerLabel", { n: minutes })}</p>
      <p className="mt-2 text-center font-black tabular-nums tracking-tight text-3xl">
        {formatClock(remainingMs)}
      </p>
      {done ? <p className="mt-2 text-center text-sm font-medium text-accent">{t("cookTimerDone")}</p> : null}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" className="btn-primary min-h-11 text-sm" onClick={start} disabled={running}>
          {t("cookTimerStart")}
        </button>
        <button type="button" className="btn-secondary min-h-11 text-sm" onClick={pause} disabled={!running}>
          {t("cookTimerPause")}
        </button>
        <button type="button" className="btn-secondary min-h-11 text-sm" onClick={reset}>
          {t("cookTimerReset")}
        </button>
      </div>
    </div>
  );
}
