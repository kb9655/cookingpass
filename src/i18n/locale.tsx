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
import { translate, type Locale, type MessageKey } from "./messages";

const STORAGE_KEY = "cookingpass:locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

function readStoredLocale(): Locale | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "en" || raw === "ko" ? raw : null;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale() ?? "ko");

  useEffect(() => {
    const stored = readStoredLocale();
    if (!stored && profile?.preferred_locale) {
      setLocaleState(profile.preferred_locale);
      localStorage.setItem(STORAGE_KEY, profile.preferred_locale);
      return;
    }
    if (stored && user && profile && profile.preferred_locale !== stored) {
      void updateProfile(user.id, { preferred_locale: stored }).catch(() => undefined);
    }
  }, [user, profile]);

  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      localStorage.setItem(STORAGE_KEY, next);
      if (user) {
        void updateProfile(user.id, { preferred_locale: next }).catch(() => undefined);
      }
    },
    [user],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
