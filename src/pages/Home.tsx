import { Link } from "react-router-dom";
import { BookOpen, UtensilsCrossed } from "lucide-react";
import { useLocale } from "../i18n/locale";

export function Home() {
  const { t } = useLocale();

  return (
    <main className="page">
      <p className="text-sm font-medium text-accent">{t("homeEyebrow")}</p>
      <h1 className="mt-2 max-w-[16ch] text-4xl font-semibold leading-[1.1] tracking-tight">
        {t("homeTitle")}
      </h1>
      <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-muted">{t("homeLead")}</p>

      <div className="mt-10 grid gap-4">
        <Link
          to="/techniques"
          className="flex min-h-40 flex-col justify-between rounded-[2rem] bg-accent px-6 py-6 text-white shadow-[inset_0_3px_0_rgba(255,255,255,0.28),0_8px_0_#16553a]"
        >
          <BookOpen className="h-8 w-8" strokeWidth={1.75} />
          <div>
            <p className="text-3xl font-semibold">{t("homeLearn")}</p>
            <p className="mt-1 text-sm text-white/80">{t("homeLearnLead")}</p>
          </div>
        </Link>
        <Link
          to="/recipes"
          className="card-casual flex min-h-40 flex-col justify-between px-6 py-6"
        >
          <UtensilsCrossed className="h-8 w-8 text-accent" strokeWidth={1.75} />
          <div>
            <p className="text-3xl font-semibold">{t("homeRecipes")}</p>
            <p className="mt-1 text-sm text-muted">{t("homeRecipesLead")}</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
