import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../hooks/useAuth";
import { updateProfile } from "../services/profileService";
import { useLocale } from "./locale";
import { prefsFromSystem, type MeasurePrefs, type MeasureSystem } from "../lib/formatMeasure";

const STORAGE_KEY = "cookingpass:units";

type MeasureContextValue = {
  prefs: MeasurePrefs;
  setAxis: (axis: keyof MeasurePrefs, next: MeasureSystem) => void;
};

const MeasureContext = createContext<MeasureContextValue | undefined>(undefined);

function isAxis(value: unknown): value is MeasureSystem {
  return value === "ko" || value === "us";
}

function readStoredPrefs(): MeasurePrefs | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  if (raw === "ko" || raw === "us") return prefsFromSystem(raw);
  try {
    const parsed = JSON.parse(raw) as Partial<MeasurePrefs>;
    if (isAxis(parsed.mass) && isAxis(parsed.volume) && isAxis(parsed.length)) {
      return { mass: parsed.mass, volume: parsed.volume, length: parsed.length };
    }
  } catch {
    return null;
  }
  return null;
}

function writeStoredPrefs(prefs: MeasurePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

function fromLocale(locale: string): MeasurePrefs {
  return prefsFromSystem(locale === "en" ? "us" : "ko");
}

function prefsFromProfile(profile: {
  preferred_mass?: MeasureSystem;
  preferred_volume?: MeasureSystem;
  preferred_length?: MeasureSystem;
} | null): MeasurePrefs | null {
  if (!profile) return null;
  if (isAxis(profile.preferred_mass) && isAxis(profile.preferred_volume) && isAxis(profile.preferred_length)) {
    return {
      mass: profile.preferred_mass,
      volume: profile.preferred_volume,
      length: profile.preferred_length,
    };
  }
  return null;
}

function samePrefs(a: MeasurePrefs, b: MeasurePrefs): boolean {
  return a.mass === b.mass && a.volume === b.volume && a.length === b.length;
}

export function MeasureProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const { user, profile } = useAuth();
  const [prefs, setPrefsState] = useState<MeasurePrefs>(() => readStoredPrefs() ?? fromLocale(locale));

  useEffect(() => {
    const stored = readStoredPrefs();
    const fromProfile = prefsFromProfile(profile);
    if (!stored && fromProfile) {
      setPrefsState(fromProfile);
      writeStoredPrefs(fromProfile);
      return;
    }
    if (!stored && !fromProfile) {
      setPrefsState(fromLocale(locale));
      return;
    }
    if (stored && user && fromProfile && !samePrefs(fromProfile, stored)) {
      void updateProfile(user.id, {
        preferred_mass: stored.mass,
        preferred_volume: stored.volume,
        preferred_length: stored.length,
      }).catch(() => undefined);
    }
  }, [user, profile, locale]);

  const setAxis = useCallback(
    (axis: keyof MeasurePrefs, next: MeasureSystem) => {
      setPrefsState((current) => {
        const updated = { ...current, [axis]: next };
        writeStoredPrefs(updated);
        if (user) {
          void updateProfile(user.id, {
            preferred_mass: updated.mass,
            preferred_volume: updated.volume,
            preferred_length: updated.length,
          }).catch(() => undefined);
        }
        return updated;
      });
    },
    [user],
  );

  const value = useMemo<MeasureContextValue>(() => ({ prefs, setAxis }), [prefs, setAxis]);

  return <MeasureContext.Provider value={value}>{children}</MeasureContext.Provider>;
}

export function useMeasure(): MeasureContextValue {
  const context = useContext(MeasureContext);
  if (!context) {
    throw new Error("useMeasure must be used within MeasureProvider");
  }
  return context;
}
