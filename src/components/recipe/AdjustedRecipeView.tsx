import { formatAmount } from "../../lib/formatAmount";
import { formatUnit } from "../../lib/formatUnit";
import { useLocale } from "../../i18n/locale";
import type { AdjustedRecipe } from "../../types/recipe";

export function AdjustedRecipeView({ recipe }: { recipe: AdjustedRecipe }) {
  const { locale, t } = useLocale();

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t("recipeServings", { n: recipe.servings })}</p>
      {recipe.notes ? <p className="text-sm leading-relaxed text-muted">{recipe.notes}</p> : null}
      {recipe.missing_or_substitutions?.length ? (
        <div>
          <h3 className="text-base font-semibold">{t("recipeSubs")}</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {recipe.missing_or_substitutions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <h3 className="text-base font-semibold">{t("recipeAdjustedIngredients")}</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {recipe.ingredients.map((item) => (
            <li key={`${item.name}-${item.substituted_for ?? ""}`}>
              {item.name} · {formatAmount(item.amount)} {formatUnit(item.unit, locale)}
              {item.substituted_for ? ` (${t("recipeSubstitute")}: ${item.substituted_for})` : null}
              {item.note ? ` · ${item.note}` : null}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-base font-semibold">{t("recipeAdjustedSteps")}</h3>
        <ol className="mt-2 space-y-2 text-sm text-muted">
          {recipe.steps.map((item) => (
            <li key={item.step}>
              <span className="font-medium text-ink">{item.step}. </span>
              {item.instruction}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
