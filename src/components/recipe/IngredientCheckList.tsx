import { useEffect, useRef, useState } from "react";
import { amountsClose, roundAmount, scaleAmount } from "../../lib/formatAmount";
import {
  convertAmount,
  formatDisplayedMeasure,
  toDisplayMeasure,
} from "../../lib/formatMeasure";
import { formatUnit } from "../../lib/formatUnit";
import { useLocale } from "../../i18n/locale";
import { useMeasure } from "../../i18n/measure";
import {
  deleteUserIngredientByIngredientId,
  upsertUserIngredient,
} from "../../services/ingredientService";
import type { RecipeIngredient, UserIngredient } from "../../types/ingredient";

export type IngredientCheck = {
  ingredient_id: string;
  name: string;
  unit: string;
  category: string;
  selected: boolean;
  amount: number;
};

function recipeNeed(
  ingredients: RecipeIngredient[],
  ingredientId: string,
  servings: number,
  baseServings: number,
): number {
  const row = ingredients.find((item) => item.ingredient_id === ingredientId);
  return roundAmount(scaleAmount(row?.amount ?? 0, servings, baseServings));
}

function toChecks(
  ingredients: RecipeIngredient[],
  pantry: UserIngredient[],
  servings: number,
  baseServings: number,
): IngredientCheck[] {
  const byId = new Map(pantry.map((item) => [item.ingredient_id, item]));
  return ingredients.map((item) => {
    const owned = byId.get(item.ingredient_id);
    const need = recipeNeed(ingredients, item.ingredient_id, servings, baseServings);
    return {
      ingredient_id: item.ingredient_id,
      name: item.name,
      unit: owned?.unit || item.unit,
      category: item.category,
      selected: true,
      amount: owned ? owned.amount : need,
    };
  });
}

export function IngredientCheckList({
  ingredients,
  pantry,
  servings,
  baseServings,
  onChange,
}: {
  ingredients: RecipeIngredient[];
  pantry: UserIngredient[];
  servings: number;
  baseServings: number;
  onChange: (items: IngredientCheck[]) => void;
}) {
  const { locale, t } = useLocale();
  const { prefs } = useMeasure();
  const [items, setItems] = useState<IngredientCheck[]>(() =>
    toChecks(ingredients, pantry, servings, baseServings),
  );
  const dirtyRef = useRef(new Set<string>());
  const servingsRef = useRef(servings);
  const baseServingsRef = useRef(baseServings);

  useEffect(() => {
    dirtyRef.current = new Set();
    const next = toChecks(ingredients, pantry, servings, baseServings);
    setItems(next);
    onChange(next);
    servingsRef.current = servings;
    baseServingsRef.current = baseServings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, pantry]);

  useEffect(() => {
    const previousServings = servingsRef.current;
    const previousBase = baseServingsRef.current;
    if (previousServings === servings && previousBase === baseServings) return;

    setItems((current) => {
      const next = current.map((item) => {
        if (dirtyRef.current.has(item.ingredient_id)) return item;
        const previousNeed = recipeNeed(
          ingredients,
          item.ingredient_id,
          previousServings,
          previousBase,
        );
        if (!amountsClose(item.amount, previousNeed)) return item;
        return {
          ...item,
          amount: recipeNeed(ingredients, item.ingredient_id, servings, baseServings),
        };
      });
      onChange(next);
      return next;
    });
    servingsRef.current = servings;
    baseServingsRef.current = baseServings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servings, baseServings, ingredients]);

  async function persist(next: IngredientCheck[]) {
    setItems(next);
    onChange(next);
    await Promise.all(
      next.map((item) =>
        item.selected
          ? upsertUserIngredient({
              ingredientId: item.ingredient_id,
              name: item.name,
              amount: item.amount,
              unit: item.unit,
              category: item.category,
              locale: "ko",
            })
          : deleteUserIngredientByIngredientId(item.ingredient_id),
      ),
    );
  }

  return (
    <div>
      <p className="text-sm text-muted">{t("recipeHaveHint")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.ingredient_id + item.name}
            type="button"
            className={`rounded-full px-3 py-2 text-sm ${
              item.selected ? "bg-accent text-white" : "border border-line bg-card text-muted"
            }`}
            onClick={() =>
              void persist(
                items.map((current) =>
                  current.ingredient_id === item.ingredient_id
                    ? { ...current, selected: !current.selected }
                    : current,
                ),
              )
            }
          >
            {item.name}
          </button>
        ))}
      </div>
      <ul className="mt-4 space-y-3">
        {items
          .filter((item) => item.selected)
          .map((item) => {
            const recipeRow = ingredients.find((row) => row.ingredient_id === item.ingredient_id);
            const sourceUnit = recipeRow?.unit || item.unit;
            const need = recipeNeed(ingredients, item.ingredient_id, servings, baseServings);
            const needDisplay = toDisplayMeasure(need, sourceUnit, prefs);
            const haveValue = roundAmount(
              convertAmount(item.amount, item.unit || sourceUnit, needDisplay.unit),
            );
            return (
              <li
                key={`${item.ingredient_id}-amount`}
                className="grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2 min-[380px]:gap-3"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted">
                    {t("recipeNeedAmount")} {formatDisplayedMeasure(need, sourceUnit, prefs, locale)}
                  </p>
                </div>
                <label className="field">
                  <span className="text-xs">
                    {t("recipeHaveAmount")} ({formatUnit(needDisplay.unit, locale)})
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={Number.isFinite(haveValue) ? haveValue : 0}
                    onChange={(event) => {
                      dirtyRef.current.add(item.ingredient_id);
                      const amount = roundAmount(
                        convertAmount(
                          Number(event.target.value),
                          needDisplay.unit,
                          item.unit || sourceUnit,
                        ),
                        4,
                      );
                      setItems((current) =>
                        current.map((row) =>
                          row.ingredient_id === item.ingredient_id ? { ...row, amount } : row,
                        ),
                      );
                    }}
                    onBlur={(event) => {
                      dirtyRef.current.add(item.ingredient_id);
                      const amount = roundAmount(
                        convertAmount(
                          Number(event.currentTarget.value),
                          needDisplay.unit,
                          item.unit || sourceUnit,
                        ),
                        4,
                      );
                      void persist(
                        items.map((row) =>
                          row.ingredient_id === item.ingredient_id ? { ...row, amount } : row,
                        ),
                      );
                    }}
                  />
                </label>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
