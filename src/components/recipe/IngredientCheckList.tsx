import { useEffect, useState } from "react";
import { formatAmount } from "../../lib/formatAmount";
import { useLocale } from "../../i18n/locale";
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

function toChecks(ingredients: RecipeIngredient[], pantry: UserIngredient[]): IngredientCheck[] {
  const byId = new Map(pantry.map((item) => [item.ingredient_id, item]));
  return ingredients.map((item) => {
    const owned = byId.get(item.ingredient_id);
    return {
      ingredient_id: item.ingredient_id,
      name: item.name,
      unit: owned?.unit || item.unit,
      category: item.category,
      selected: true,
      amount: owned?.amount ?? item.amount ?? 1,
    };
  });
}

export function IngredientCheckList({
  ingredients,
  pantry,
  onChange,
}: {
  ingredients: RecipeIngredient[];
  pantry: UserIngredient[];
  onChange: (items: IngredientCheck[]) => void;
}) {
  const { t } = useLocale();
  const [items, setItems] = useState<IngredientCheck[]>(() => toChecks(ingredients, pantry));

  useEffect(() => {
    const next = toChecks(ingredients, pantry);
    setItems(next);
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients, pantry]);

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
          .map((item) => (
            <li key={`${item.ingredient_id}-amount`} className="grid grid-cols-[1fr_7rem] items-end gap-3">
              <div>
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted">
                  {t("recipeNeedAmount")}{" "}
                  {formatAmount(
                    ingredients.find((row) => row.ingredient_id === item.ingredient_id)?.amount ?? 0,
                  )}{" "}
                  {item.unit}
                </p>
              </div>
              <label className="field">
                <span className="text-xs">{t("recipeHaveAmount")}</span>
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  value={item.amount}
                  onChange={(event) => {
                    const amount = Number(event.target.value);
                    setItems((current) =>
                      current.map((row) =>
                        row.ingredient_id === item.ingredient_id ? { ...row, amount } : row,
                      ),
                    );
                  }}
                  onBlur={(event) => {
                    const amount = Number(event.currentTarget.value);
                    void persist(
                      items.map((row) =>
                        row.ingredient_id === item.ingredient_id ? { ...row, amount } : row,
                      ),
                    );
                  }}
                />
              </label>
            </li>
          ))}
      </ul>
    </div>
  );
}
