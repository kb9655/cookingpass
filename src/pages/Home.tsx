import { Link } from "react-router-dom";
import { BookOpen, UtensilsCrossed } from "lucide-react";
import { useLocale } from "../i18n/locale";

export function Home() {
  const { t } = useLocale();

  return (
    <main className="page">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">{t("homeEyebrow")}</p>

      <div className="mt-6 grid gap-4">
        <Link
          to="/techniques"
          className="flex min-h-44 flex-col justify-between rounded-[2rem] bg-accent px-6 py-6 text-white transition active:translate-y-0.5"
          style={{ boxShadow: "inset 0 4px 0 rgba(255,255,255,0.28), 0 10px 0 #1a7a45" }}
        >
          <BookOpen className="h-9 w-9" strokeWidth={2.2} />
          <div>
            <p className="text-3xl font-black">{t("homeLearn")}</p>
            <p className="mt-1 text-sm text-white/80">{t("homeLearnLead")}</p>
          </div>
        </Link>
        <Link
          to="/recipes"
          className="card-casual flex min-h-44 flex-col justify-between px-6 py-6 transition active:translate-y-0.5"
        >
          <UtensilsCrossed className="h-9 w-9 text-accent" strokeWidth={2.2} />
          <div>
            <p className="text-3xl font-black">{t("homeRecipes")}</p>
            <p className="mt-1 text-sm text-muted">{t("homeRecipesLead")}</p>
          </div>
        </Link>
      </div>
    </main>
  );
}
