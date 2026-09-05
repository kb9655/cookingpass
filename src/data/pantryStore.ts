import type { UserIngredient } from "../types/ingredient";

const STORAGE_KEY = "cookingpass:pantry";

function read(): UserIngredient[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UserIngredient[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: UserIngredient[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listPantry(): UserIngredient[] {
  return read().sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function upsertPantryItem(input: {
  ingredientId: string;
  name: string;
  amount: number;
  unit: string;
  category?: string;
  defaultUnit?: string;
  expiresAt?: string | null;
}): UserIngredient {
  const items = read();
  const existing = items.find((item) => item.ingredient_id === input.ingredientId);
  const next: UserIngredient = {
    id: existing?.id ?? `pantry-${input.ingredientId}`,
    ingredient_id: input.ingredientId,
    name: input.name,
    amount: input.amount,
    unit: input.unit,
    expires_at: input.expiresAt ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(),
    category: input.category ?? existing?.category ?? "",
    default_unit: input.defaultUnit ?? input.unit,
  };

  const updated = existing
    ? items.map((item) => (item.ingredient_id === input.ingredientId ? next : item))
    : [next, ...items];
  write(updated);
  return next;
}

export function updatePantryItem(
  id: string,
  patch: { amount: number; unit: string; expires_at?: string | null },
): void {
  write(
    read().map((item) =>
      item.id === id
        ? {
            ...item,
            amount: patch.amount,
            unit: patch.unit,
            expires_at: patch.expires_at ?? item.expires_at,
          }
        : item,
    ),
  );
}

export function deletePantryItem(id: string): void {
  write(read().filter((item) => item.id !== id));
}
