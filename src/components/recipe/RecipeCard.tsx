import { Link } from "react-router-dom";
import type { ScoredRecipe } from "../../types/recipe";
import { StarRating } from "../common/StarRating";

export function RecipeCard({
  recipe,
  highlight,
}: {
  recipe: ScoredRecipe;
  highlight?: boolean;
}) {
  return (
    <Link to={`/recipes/${recipe.id}`}>
      <article
        className={`rounded-[1.5rem] border bg-card p-4 ${
          highlight ? "border-accent" : "border-line"
        }`}
      >
        {highlight ? (
          <p className="mb-2 text-xs font-semibold text-accent">방금 배운 기술과 연결됨</p>
        ) : null}
        <h2 className="text-lg font-semibold">{recipe.name}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{recipe.description}</p>
        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <StarRating value={recipe.difficulty} />
          <span>약 {recipe.estimated_minutes}분</span>
        </div>
        {typeof recipe.score === "number" && recipe.score > 0 ? (
          <p className="mt-2 text-xs text-muted">추천 적합도 {Math.round(recipe.score * 100)}%</p>
        ) : null}
      </article>
    </Link>
  );
}
