import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ViewMode = "auto" | "landscape";

const STORAGE_KEY = "cookingpass:view-mode";
const ViewModeContext = createContext<{
  mode: ViewMode;
  toggle: () => void;
} | null>(null);

function readMode(): ViewMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "landscape" ? "landscape" : "auto";
  } catch {
    return "auto";
  }
}

function shouldForceRotate(mode: ViewMode): boolean {
  if (mode !== "landscape") return false;
  const portrait = window.innerHeight > window.innerWidth;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 900;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return portrait && narrow && coarse;
}

function applyView(mode: ViewMode) {
  const nativeLandscape = window.matchMedia("(orientation: landscape)").matches;
  const view = mode === "landscape" || nativeLandscape ? "landscape" : "portrait";
  document.documentElement.dataset.view = view;
  document.documentElement.dataset.forcedRotate = shouldForceRotate(mode) ? "true" : "false";
}

async function tryOrientationLock(mode: ViewMode) {
  const orientation = screen.orientation as ScreenOrientation & {
    lock?: (type: string) => Promise<void>;
    unlock?: () => void;
  };
  try {
    if (mode === "landscape") {
      await orientation.lock?.("landscape");
    } else {
      orientation.unlock?.();
    }
  } catch {
    // Mobile browsers often reject lock outside fullscreen / installed PWAs.
  }
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ViewMode>(readMode);

  useEffect(() => {
    applyView(mode);
    void tryOrientationLock(mode);
    const refresh = () => applyView(mode);
    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
    };
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((current) => {
      const next: ViewMode = current === "landscape" ? "auto" : "landscape";
      try {
        if (next === "auto") localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore quota / private-mode failures.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const value = useContext(ViewModeContext);
  if (!value) throw new Error("useViewMode requires ViewModeProvider");
  return value;
}
