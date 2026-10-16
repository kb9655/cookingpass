import { useCallback, useEffect, useRef, useState } from "react";
import {
  minutesToMs,
  playTimerChime,
  requestTimerNotificationPermission,
  showTimerNotification,
  type WaitTimer,
} from "../lib/cookTimer";

export function useWaitTimer(notifyTitle: string, notifyBody: (step: string) => string) {
  const [timers, setTimers] = useState<WaitTimer[]>([]);
  const timersRef = useRef<WaitTimer[]>([]);
  const notifyTitleRef = useRef(notifyTitle);
  const notifyBodyRef = useRef(notifyBody);
  const notifyTimeoutsRef = useRef<Map<number, number>>(new Map());
  const firedRef = useRef<Set<number>>(new Set());

  timersRef.current = timers;
  notifyTitleRef.current = notifyTitle;
  notifyBodyRef.current = notifyBody;

  const clearNotifyTimeout = useCallback((stepIndex?: number) => {
    if (stepIndex == null) {
      for (const id of notifyTimeoutsRef.current.values()) window.clearTimeout(id);
      notifyTimeoutsRef.current.clear();
      return;
    }
    const id = notifyTimeoutsRef.current.get(stepIndex);
    if (id != null) {
      window.clearTimeout(id);
      notifyTimeoutsRef.current.delete(stepIndex);
    }
  }, []);

  const fireDone = useCallback(
    (current: WaitTimer) => {
      if (firedRef.current.has(current.stepIndex)) return;
      firedRef.current.add(current.stepIndex);
      clearNotifyTimeout(current.stepIndex);
      const stepLabel = `STEP ${current.stepNumber}${current.label ? ` · ${current.label}` : ""}`;
      if (typeof document !== "undefined" && document.hidden) {
        showTimerNotification(
          notifyTitleRef.current,
          notifyBodyRef.current(stepLabel),
          `cookingpass-wait-timer-${current.stepIndex}`,
        );
      } else {
        playTimerChime();
      }
    },
    [clearNotifyTimeout],
  );

  const scheduleHiddenNotify = useCallback(
    (current: WaitTimer) => {
      clearNotifyTimeout(current.stepIndex);
      if (!current.running || current.endAt == null) return;
      const delay = Math.max(0, current.endAt - Date.now());
      const timeoutId = window.setTimeout(() => {
        const latest = timersRef.current.find((item) => item.stepIndex === current.stepIndex);
        if (!latest?.running) return;
        const remaining = latest.endAt != null ? latest.endAt - Date.now() : latest.remainingMs;
        if (remaining > 50) return;
        fireDone({ ...latest, remainingMs: 0, running: false, endAt: null, done: true });
        setTimers((prev) =>
          prev.map((item) =>
            item.stepIndex === current.stepIndex
              ? { ...item, remainingMs: 0, running: false, endAt: null, done: true }
              : item,
          ),
        );
      }, delay);
      notifyTimeoutsRef.current.set(current.stepIndex, timeoutId);
    },
    [clearNotifyTimeout, fireDone],
  );

  const anyRunning = timers.some((item) => item.running && item.endAt != null);
  const runningSignature = timers
    .filter((item) => item.running && item.endAt != null)
    .map((item) => `${item.stepIndex}:${item.endAt}`)
    .join("|");

  useEffect(() => {
    if (!anyRunning) {
      return;
    }
    const id = window.setInterval(() => {
      setTimers((current) => {
        let changed = false;
        const next = current.map((timer) => {
          if (!timer.running || timer.endAt == null) return timer;
          const remaining = Math.max(0, timer.endAt - Date.now());
          if (remaining <= 0) {
            fireDone(timer);
            changed = true;
            return { ...timer, remainingMs: 0, running: false, endAt: null, done: true };
          }
          changed = true;
          return { ...timer, remainingMs: remaining };
        });
        return changed ? next : current;
      });
    }, 200);
    return () => {
      window.clearInterval(id);
    };
  }, [anyRunning, fireDone]);

  useEffect(() => {
    const live = new Set(
      timersRef.current.filter((item) => item.running && item.endAt != null).map((item) => item.stepIndex),
    );
    for (const stepIndex of [...notifyTimeoutsRef.current.keys()]) {
      if (!live.has(stepIndex)) clearNotifyTimeout(stepIndex);
    }
    for (const timer of timersRef.current) {
      if (timer.running && timer.endAt != null) scheduleHiddenNotify(timer);
    }
  }, [runningSignature, scheduleHiddenNotify, clearNotifyTimeout]);

  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        for (const current of timersRef.current) {
          if (current.running) scheduleHiddenNotify(current);
        }
      } else {
        clearNotifyTimeout();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clearNotifyTimeout, scheduleHiddenNotify]);

  useEffect(() => () => clearNotifyTimeout(), [clearNotifyTimeout]);

  const start = useCallback(
    (input: { stepIndex: number; stepNumber: number; label: string; minutes: number }) => {
      firedRef.current.delete(input.stepIndex);
      const totalMs = minutesToMs(input.minutes);
      setTimers((current) => {
        const previous = current.find((item) => item.stepIndex === input.stepIndex);
        const sameStep = previous && !previous.done;
        const remainingMs = sameStep && previous.remainingMs > 0 ? previous.remainingMs : totalMs;
        const next: WaitTimer = {
          stepIndex: input.stepIndex,
          stepNumber: input.stepNumber,
          label: input.label,
          totalMs,
          remainingMs,
          endAt: Date.now() + remainingMs,
          running: true,
          done: false,
        };
        return [...current.filter((item) => item.stepIndex !== input.stepIndex), next];
      });
      void requestTimerNotificationPermission();
    },
    [],
  );

  const pause = useCallback(
    (stepIndex: number) => {
      setTimers((current) =>
        current.map((item) => {
          if (item.stepIndex !== stepIndex || !item.running) return item;
          const remaining = item.endAt != null ? Math.max(0, item.endAt - Date.now()) : item.remainingMs;
          return { ...item, remainingMs: remaining, running: false, endAt: null };
        }),
      );
      clearNotifyTimeout(stepIndex);
    },
    [clearNotifyTimeout],
  );

  const reset = useCallback(
    (stepIndex: number) => {
      firedRef.current.delete(stepIndex);
      clearNotifyTimeout(stepIndex);
      setTimers((current) =>
        current.map((item) =>
          item.stepIndex === stepIndex
            ? {
                ...item,
                remainingMs: item.totalMs,
                running: false,
                endAt: null,
                done: false,
              }
            : item,
        ),
      );
    },
    [clearNotifyTimeout],
  );

  const clear = useCallback(() => {
    firedRef.current.clear();
    clearNotifyTimeout();
    setTimers([]);
  }, [clearNotifyTimeout]);

  return { timers, start, pause, reset, clear };
}
