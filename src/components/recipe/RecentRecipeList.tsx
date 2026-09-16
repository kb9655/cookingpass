import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLocale } from "../../i18n/locale";
import { readLocalVisits, type RecipeVisit } from "../../services/recipeVisitService";

export function RecentRecipeList({ title }: { title: string }) {
  const { locale, t } = useLocale();
  const location = useLocation();
  const [visits, setVisits] = useState<RecipeVisit[]>(() => readLocalVisits());

  useEffect(() => {
    setVisits(readLocalVisits());
  }, [location.pathname]);

  if (visits.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-black">{title}</h2>
      <ul className="mt-3 space-y-2">
        {visits.map((item) => (
          <li key={item.recipeId}>
            <Link
              to={`/recipes/${item.recipeId}`}
              className="card-casual flex min-w-0 flex-col gap-1 px-4 py-3 text-sm"
            >
              <span className="flex min-w-0 items-start justify-between gap-3">
                <span className="min-w-0 flex-1 break-keep font-medium">{item.recipeName}</span>
                <span className="shrink-0 text-muted">{t("recipeServings", { n: item.servings })}</span>
              </span>
              {item.notes ? (
                <span className="line-clamp-1 text-muted">{item.notes}</span>
              ) : null}
              <span className="text-xs text-muted">
                {new Date(item.visitedAt).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
