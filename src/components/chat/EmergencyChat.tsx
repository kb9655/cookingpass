import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageCircle, Minus, RotateCcw, Send, ShieldAlert, Square, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useLocale } from "../../i18n/locale";
import { requireSupabase } from "../../lib/supabase";
import {
  useEmergencyChatContext,
  type EmergencyChatPageContext,
} from "./EmergencyChatProvider";

const QUICK_PROMPT_KEYS = [
  "emergencyChatQuickHeat",
  "emergencyChatQuickTexture",
  "emergencyChatQuickTiming",
] as const;

function EmergencyChatPanel({ context }: { context: EmergencyChatPageContext }) {
  const location = useLocation();
  const { locale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const isLessonPage =
    location.pathname.startsWith("/cook/") || /^\/techniques\/[^/]+/.test(location.pathname);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const {
            data: { session },
          } = await requireSupabase().auth.getSession();
          return session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {};
        },
        body: () => ({ context, locale }),
      }),
    [context, locale],
  );

  const { messages, sendMessage, status, stop, error, regenerate, setMessages } = useChat({
    transport,
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    void sendMessage({ text });
    setInput("");
  }

  function sendQuickPrompt(text: string) {
    if (busy) return;
    void sendMessage({ text });
  }

  function closeChat() {
    if (busy) stop();
    setMessages([]);
    setInput("");
    setOpen(false);
  }

  const bottomClass = isLessonPage
    ? "bottom-[calc(0.75rem+env(safe-area-inset-bottom))]"
    : "bottom-[calc(5.25rem+env(safe-area-inset-bottom))]";

  if (!open) {
    return (
      <button
        type="button"
        className={`fixed right-[calc(0.75rem+env(safe-area-inset-right))] ${bottomClass} z-[60] flex min-h-12 items-center gap-2 rounded-full border border-accent/30 bg-accent px-4 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5`}
        aria-label={t("emergencyChatOpen")}
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        <span>{t("emergencyChatButton")}</span>
      </button>
    );
  }

  return (
    <section
      className={`fixed left-[calc(0.5rem+env(safe-area-inset-left))] right-[calc(0.5rem+env(safe-area-inset-right))] ${bottomClass} z-[60] flex max-h-[min(72dvh,42rem)] flex-col overflow-hidden rounded-[1.5rem] border border-line bg-card shadow-lg sm:left-auto sm:w-full sm:max-w-sm`}
      aria-label={t("emergencyChatTitle")}
    >
      <header className="flex items-center gap-3 border-b border-line bg-canvas px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white">
          <ShieldAlert className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-black">{t("emergencyChatTitle")}</h2>
          <p className="truncate text-xs text-muted">
            {context.title}
            {context.stage ? ` · ${context.stage}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-line/50 hover:text-ink"
          aria-label={t("emergencyChatMinimize")}
          onClick={() => setOpen(false)}
        >
          <Minus className="size-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-full text-muted hover:bg-line/50 hover:text-ink"
          aria-label={t("emergencyChatClose")}
          onClick={closeChat}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-36 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <p className="text-sm leading-6 text-ink">{t("emergencyChatLead")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_PROMPT_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="rounded-full border border-line bg-white px-3 py-2 text-left text-xs font-bold text-ink hover:border-accent"
                  onClick={() => sendQuickPrompt(t(key))}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const text = message.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("");
            if (!text) return null;
            return (
              <div
                key={message.id}
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6 ${
                  message.role === "user"
                    ? "ml-auto bg-accent text-white"
                    : "border border-line bg-white text-ink"
                }`}
              >
                {text}
              </div>
            );
          })
        )}
        {status === "submitted" ? (
          <p className="text-xs font-bold text-muted">{t("emergencyChatThinking")}</p>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <p>{t("emergencyChatError")}</p>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 font-black underline"
              onClick={() => void regenerate()}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t("emergencyChatRetry")}
            </button>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form className="border-t border-line bg-card p-3" onSubmit={submit}>
        <div className="flex items-end gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-2xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder={t("emergencyChatPlaceholder")}
            maxLength={2_000}
            disabled={busy}
          />
          {busy ? (
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-white"
              aria-label={t("emergencyChatStop")}
              onClick={stop}
            >
              <Square className="size-4 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-50"
              aria-label={t("emergencyChatSend")}
              disabled={!input.trim()}
            >
              <Send className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="mt-2 px-1 text-[11px] leading-4 text-muted">{t("emergencyChatSafety")}</p>
      </form>
    </section>
  );
}

export function EmergencyChat() {
  const { user } = useAuth();
  const { pageContext } = useEmergencyChatContext();
  if (!user || !pageContext) return null;
  return <EmergencyChatPanel key={pageContext.key} context={pageContext} />;
}
