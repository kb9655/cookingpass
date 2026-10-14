import { useCallback, useEffect, useRef, useState } from "react";
import {
  minutesToMs,
  playTimerChime,
  requestTimerNotificationPermission,
  showTimerNotification,
  type WaitTimer,
} from "../lib/cookTimer";

export function useWaitTimer(notifyTitle: string, notifyBody: (step: string) => string) {
  const [timer, setTimer] = useState<WaitTimer | null>(null);
  const timerRef = useRef<WaitTimer | null>(null);
  const notifyTitleRef = useRef(notifyTitle);
  const notifyBodyRef = useRef(notifyBody);
  const notifyTimeoutRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  timerRef.current = timer;
  notifyTitleRef.current = notifyTitle;
  notifyBodyRef.current = notifyBody;

  const clearNotifyTimeout = useCallback(() => {
    if (notifyTimeoutRef.current != null) {
      window.clearTimeout(notifyTimeoutRef.current);
      notifyTimeoutRef.current = null;
    }
  }, []);

  const fireDone = useCallback(
    (current: WaitTimer) => {
      if (firedRef.current) return;
      firedRef.current = true;
      clearNotifyTimeout();
      const stepLabel = `STEP ${current.stepNumber}${current.label ? ` · ${current.label}` : ""}`;
      if (typeof document !== "undefined" && document.hidden) {
        showTimerNotification(notifyTitleRef.current, notifyBodyRef.current(stepLabel));
      } else {
        playTimerChime();
      }
    },
    [clearNotifyTimeout],
  );

  const scheduleHiddenNotify = useCallback(
    (current: WaitTimer) => {
      clearNotifyTimeout();
      if (!current.running || current.endAt == null) return;
      const delay = Math.max(0, current.endAt - Date.now());
      notifyTimeoutRef.current = window.setTimeout(() => {
        const latest = timerRef.current;
        if (!latest?.running) return;
        const remaining = latest.endAt != null ? latest.endAt - Date.now() : latest.remainingMs;
        if (remaining > 50) return;
        fireDone({ ...latest, remainingMs: 0, running: false, endAt: null, done: true });
        setTimer((prev) =>
          prev ? { ...prev, remainingMs: 0, running: false, endAt: null, done: true } : prev,
        );
      }, delay);
    },
    [clearNotifyTimeout, fireDone],
  );

  useEffect(() => {
    if (!timer?.running || timer.endAt == null) {
      clearNotifyTimeout();
      return;
    }
    const id = window.setInterval(() => {
      setTimer((current) => {
        if (!current?.running || current.endAt == null) return current;
        const remaining = Math.max(0, current.endAt - Date.now());
        if (remaining <= 0) {
          fireDone(current);
          return { ...current, remainingMs: 0, running: false, endAt: null, done: true };
        }
        return { ...current, remainingMs: remaining };
      });
    }, 200);
    scheduleHiddenNotify(timer);
    return () => {
      window.clearInterval(id);
    };
  }, [timer?.running, timer?.endAt, clearNotifyTimeout, fireDone, scheduleHiddenNotify]);

  useEffect(() => {
    function onVisibility() {
      const current = timerRef.current;
      if (!current?.running) return;
      if (document.hidden) scheduleHiddenNotify(current);
      else clearNotifyTimeout();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clearNotifyTimeout, scheduleHiddenNotify]);

  useEffect(() => () => clearNotifyTimeout(), [clearNotifyTimeout]);

  const start = useCallback(
    (input: { stepIndex: number; stepNumber: number; label: string; minutes: number }) => {
      firedRef.current = false;
      const totalMs = minutesToMs(input.minutes);
      const previous = timerRef.current;
      const sameStep = previous && previous.stepIndex === input.stepIndex && !previous.done;
      const remainingMs = sameStep && previous.remainingMs > 0 ? previous.remainingMs : totalMs;
      setTimer({
        stepIndex: input.stepIndex,
        stepNumber: input.stepNumber,
        label: input.label,
        totalMs,
        remainingMs,
        endAt: Date.now() + remainingMs,
        running: true,
        done: false,
      });
      void requestTimerNotificationPermission();
    },
    [],
  );

  const pause = useCallback(() => {
    setTimer((current) => {
      if (!current?.running) return current;
      const remaining =
        current.endAt != null ? Math.max(0, current.endAt - Date.now()) : current.remainingMs;
      return { ...current, remainingMs: remaining, running: false, endAt: null };
    });
    clearNotifyTimeout();
  }, [clearNotifyTimeout]);

  const reset = useCallback(() => {
    firedRef.current = false;
    clearNotifyTimeout();
    setTimer((current) =>
      current
        ? {
            ...current,
            remainingMs: current.totalMs,
            running: false,
            endAt: null,
            done: false,
          }
        : current,
    );
  }, [clearNotifyTimeout]);

  const clear = useCallback(() => {
    firedRef.current = false;
    clearNotifyTimeout();
    setTimer(null);
  }, [clearNotifyTimeout]);

  return { timer, start, pause, reset, clear };
}
