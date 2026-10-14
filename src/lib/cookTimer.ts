export const SKIP_TIMER_LEAVE_CONFIRM_KEY = "cookingpass:skip-timer-leave-confirm";

export type WaitTimer = {
  stepIndex: number;
  stepNumber: number;
  label: string;
  totalMs: number;
  remainingMs: number;
  endAt: number | null;
  running: boolean;
  done: boolean;
};

export function formatTimerClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function minutesToMs(minutes: number): number {
  return Math.max(0, Math.round(minutes * 60 * 1000));
}

export function shouldConfirmTimerLeave(): boolean {
  try {
    return localStorage.getItem(SKIP_TIMER_LEAVE_CONFIRM_KEY) !== "1";
  } catch {
    return true;
  }
}

export function setSkipTimerLeaveConfirm(): void {
  try {
    localStorage.setItem(SKIP_TIMER_LEAVE_CONFIRM_KEY, "1");
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export async function requestTimerNotificationPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export function showTimerNotification(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const notification = new Notification(title, { body, tag: "cookingpass-wait-timer" });
    window.setTimeout(() => notification.close(), 12_000);
  } catch {
    // Some browsers require a service worker for Notification construction.
  }
}

export function playTimerChime(): void {
  const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.08;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.6);
  oscillator.stop(context.currentTime + 0.6);
  window.setTimeout(() => void context.close(), 800);
}
