import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type EmergencyChatPageContext = {
  key: string;
  kind: "technique" | "recipe" | "cooking";
  title: string;
  stage?: string;
  instruction?: string;
  warnings?: string[];
  ingredients?: string[];
  tools?: string[];
};

type EmergencyChatContextValue = {
  pageContext: EmergencyChatPageContext | null;
  setPageContext: (context: EmergencyChatPageContext) => void;
  clearPageContext: (key: string) => void;
};

const EmergencyChatContext = createContext<EmergencyChatContextValue | undefined>(undefined);

export function EmergencyChatProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContextState] = useState<EmergencyChatPageContext | null>(null);

  const setPageContext = useCallback((context: EmergencyChatPageContext) => {
    setPageContextState(context);
  }, []);

  const clearPageContext = useCallback((key: string) => {
    setPageContextState((current) => (current?.key === key ? null : current));
  }, []);

  const value = useMemo(
    () => ({ pageContext, setPageContext, clearPageContext }),
    [pageContext, setPageContext, clearPageContext],
  );

  return <EmergencyChatContext.Provider value={value}>{children}</EmergencyChatContext.Provider>;
}

export function useEmergencyChatContext(): EmergencyChatContextValue {
  const context = useContext(EmergencyChatContext);
  if (!context) {
    throw new Error("useEmergencyChatContext must be used within EmergencyChatProvider");
  }
  return context;
}

export function useEmergencyChatPage(context: EmergencyChatPageContext | null): void {
  const { setPageContext, clearPageContext } = useEmergencyChatContext();
  const serialized = context ? JSON.stringify(context) : "";

  useEffect(() => {
    if (!serialized) return;
    const next = JSON.parse(serialized) as EmergencyChatPageContext;
    setPageContext(next);
    return () => clearPageContext(next.key);
  }, [serialized, setPageContext, clearPageContext]);
}
