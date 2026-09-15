import { Link } from "react-router-dom";
import { useLocale } from "../../i18n/locale";
import type { ScoredRecipe } from "../../types/recipe";
import { StarRating } from "../common/StarRating";

export function RecipeCard({
  recipe,
  highlight,
}: {
  recipe: ScoredRecipe;
  highlight?: boolean;
}) {
  const { t } = useLocale();

  return (
    <Link to={`/recipes/${recipe.id}`}>
      <article
        className={`card-casual p-4 ${highlight ? "border-accent" : ""}`}
      >
        {highlight ? (
          <p className="mb-2 text-xs font-semibold text-accent">{t("recipesLinkedSkill")}</p>
        ) : null}
        <h2 className="text-lg font-black">{recipe.name}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{recipe.description}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <StarRating value={recipe.difficulty} />
          <span>{t("recipeMinutes", { n: recipe.estimated_minutes })}</span>
        </div>
        <p className="mt-2 text-xs text-muted">{t("recipeBaseServings", { n: recipe.servings })}</p>
        {typeof recipe.score === "number" && recipe.score > 0 ? (
          <p className="mt-2 text-xs text-muted">{t("recipesFit", { n: Math.round(recipe.score * 100) })}</p>
        ) : null}
      </article>
    </Link>
  );
}
