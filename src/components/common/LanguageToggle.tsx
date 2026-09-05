import { useLocale } from "../../i18n/locale";
import type { Locale } from "../../i18n/messages";

const OPTIONS: Array<{ value: Locale; labelKey: "languageKo" | "languageEn" }> = [
  { value: "ko", labelKey: "languageKo" },
  { value: "en", labelKey: "languageEn" },
];

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className={className}>
      <p className="text-sm font-medium">{t("language")}</p>
      <div className="mt-2 flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-full px-3 py-1 text-sm ${
              locale === option.value ? "bg-accent text-white" : "border border-line"
            }`}
            onClick={() => setLocale(option.value)}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
