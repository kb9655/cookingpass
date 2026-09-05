import { customIngredient } from "../data/recipeRepository";
import { deletePantryItem, listPantry, updatePantryItem, upsertPantryItem } from "../data/pantryStore";
import type { Locale } from "../i18n/messages";
import type { RecipeIngredient, UserIngredient } from "../types/ingredient";
import { listCatalogIngredients } from "./recipeService";

export { listCatalogIngredients, customIngredient };

export async function listUserIngredients(locale: Locale = "ko"): Promise<UserIngredient[]> {
  const [pantry, catalog] = await Promise.all([Promise.resolve(listPantry()), listCatalogIngredients(locale)]);
  const names = new Map(catalog.map((item) => [item.id, item]));
  return pantry.map((item) => {
    const fromCatalog = names.get(item.ingredient_id);
    return fromCatalog
      ? {
          ...item,
          name: fromCatalog.name,
          category: fromCatalog.category || item.category,
          default_unit: fromCatalog.default_unit || item.default_unit,
        }
      : item;
  });
}

export async function upsertUserIngredient(input: {
  userId?: string;
  ingredientId: string;
  name?: string;
  amount: number;
  unit: string;
  expiresAt?: string | null;
  category?: string;
  locale?: Locale;
}): Promise<void> {
  const catalog = await listCatalogIngredients(input.locale ?? "ko");
  const fromCatalog = catalog.find((item) => item.id === input.ingredientId);
  const fallback = input.name ? customIngredient(input.name, input.unit) : null;
  const ingredient = fromCatalog ?? fallback;
  if (!ingredient) {
    throw new Error("추가할 재료를 선택하세요.");
  }

  upsertPantryItem({
    ingredientId: ingredient.id,
    name: ingredient.name,
    amount: input.amount,
    unit: input.unit,
    category: input.category ?? ingredient.category,
    defaultUnit: ingredient.default_unit,
    expiresAt: input.expiresAt,
  });
}

export async function updateUserIngredient(
  id: string,
  patch: { amount: number; unit: string; expires_at?: string | null },
): Promise<void> {
  updatePantryItem(id, patch);
}

export async function deleteUserIngredient(id: string): Promise<void> {
  deletePantryItem(id);
}

export function toRecipeIngredients(
  rows: {
    amount: number;
    unit: string;
    notes: string | null;
    ingredient_id: string;
    ingredients: { name: string; category: string } | { name: string; category: string }[] | null;
  }[],
): RecipeIngredient[] {
  return rows.map((row) => {
    const ingredient = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    return {
      ingredient_id: row.ingredient_id,
      amount: Number(row.amount),
      unit: row.unit,
      notes: row.notes,
      name: ingredient?.name ?? "재료",
      category: ingredient?.category ?? "",
    };
  });
}
