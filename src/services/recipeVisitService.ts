import type { Locale } from "../i18n/messages";
import { isSupabaseConfigured, requireSupabase } from "../lib/supabase";

export type RecipeVisit = {
  recipeId: string;
  recipeName: string;
  servings: number;
  notes: string;
  visitedAt: string;
};

const STORAGE_KEY = "cookingpass:recent-recipes";
const LIMIT = 20;
const listeners = new Set<() => void>();

function notifyVisitsChanged(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeVisits(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type RecipeNameJoin = {
  name?: string;
  recipe_translations?: Array<{ locale: string; name: string }> | null;
} | null;

function pickName(recipe: RecipeNameJoin, locale: Locale, fallback: string): string {
  const translations = recipe?.recipe_translations ?? [];
  const localized =
    translations.find((row) => row.locale === locale)?.name ??
    translations.find((row) => row.locale === "en")?.name ??
    recipe?.name;
  return localized?.trim() || fallback;
}

function clampServings(value: number): number {
  if (!Number.isFinite(value)) return 2;
  return Math.min(16, Math.max(1, Math.round(value)));
}

function isVisit(value: unknown): value is RecipeVisit {
  if (!value || typeof value !== "object") return false;
  const item = value as RecipeVisit;
  return Boolean(item.recipeId && item.recipeName && item.visitedAt);
}

export function readLocalVisits(): RecipeVisit[] {
  if (typeof localStorage === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isVisit).slice(0, LIMIT);
  } catch {
    return [];
  }
}

function writeLocalVisits(items: RecipeVisit[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, LIMIT)));
  notifyVisitsChanged();
}

function upsertLocal(visit: RecipeVisit): RecipeVisit[] {
  const next = [visit, ...readLocalVisits().filter((item) => item.recipeId !== visit.recipeId)].slice(
    0,
    LIMIT,
  );
  writeLocalVisits(next);
  return next;
}

export function getLocalVisit(recipeId: string): RecipeVisit | null {
  return readLocalVisits().find((item) => item.recipeId === recipeId) ?? null;
}

async function trimRemote(userId: string): Promise<void> {
  const { data, error } = await requireSupabase()
    .from("recipe_visits")
    .select("id")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false });
  if (error) throw error;
  const extra = (data ?? []).slice(LIMIT).map((row) => row.id as string);
  if (extra.length === 0) return;
  const { error: deleteError } = await requireSupabase().from("recipe_visits").delete().in("id", extra);
  if (deleteError) throw deleteError;
}

async function upsertRemote(userId: string, visit: RecipeVisit): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await requireSupabase().from("recipe_visits").upsert(
    {
      user_id: userId,
      recipe_id: visit.recipeId,
      servings: visit.servings,
      notes: visit.notes.slice(0, 500),
      visited_at: visit.visitedAt,
    },
    { onConflict: "user_id,recipe_id" },
  );
  if (error) throw error;
  await trimRemote(userId);
}

async function listRemoteVisits(userId: string, locale: Locale): Promise<RecipeVisit[]> {
  const { data, error } = await requireSupabase()
    .from("recipe_visits")
    .select("recipe_id, servings, notes, visited_at, recipes(name, recipe_translations(locale, name))")
    .eq("user_id", userId)
    .order("visited_at", { ascending: false })
    .limit(LIMIT);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const recipe = Array.isArray(row.recipes) ? row.recipes[0] : row.recipes;
    return {
      recipeId: row.recipe_id as string,
      recipeName: pickName(recipe as RecipeNameJoin, locale, "레시피"),
      servings: clampServings(Number(row.servings)),
      notes: String(row.notes ?? ""),
      visitedAt: row.visited_at as string,
    };
  });
}

function mergeVisits(local: RecipeVisit[], remote: RecipeVisit[]): RecipeVisit[] {
  const byId = new Map<string, RecipeVisit>();
  for (const item of [...local, ...remote]) {
    const previous = byId.get(item.recipeId);
    if (!previous || previous.visitedAt < item.visitedAt) byId.set(item.recipeId, item);
  }
  return [...byId.values()]
    .sort((a, b) => (a.visitedAt < b.visitedAt ? 1 : -1))
    .slice(0, LIMIT);
}

export function rememberRecipeVisit(
  input: { recipeId: string; recipeName: string; servings: number; notes: string },
  userId?: string | null,
): void {
  const visit: RecipeVisit = {
    recipeId: input.recipeId,
    recipeName: input.recipeName.trim() || "레시피",
    servings: clampServings(input.servings),
    notes: input.notes.trim().slice(0, 500),
    visitedAt: new Date().toISOString(),
  };
  upsertLocal(visit);
  if (userId && isSupabaseConfigured) {
    void upsertRemote(userId, visit).catch(() => undefined);
  }
}

export async function mergeRecipeVisits(userId: string, locale: Locale): Promise<void> {
  if (!isSupabaseConfigured) return;
  const remote = await listRemoteVisits(userId, locale);
  const merged = mergeVisits(readLocalVisits(), remote);
  writeLocalVisits(merged);
  const keep = new Set(merged.map((item) => item.recipeId));
  await Promise.all(
    merged.map((item) =>
      requireSupabase()
        .from("recipe_visits")
        .upsert(
          {
            user_id: userId,
            recipe_id: item.recipeId,
            servings: item.servings,
            notes: item.notes.slice(0, 500),
            visited_at: item.visitedAt,
          },
          { onConflict: "user_id,recipe_id" },
        ),
    ),
  );
  const extra = remote.filter((item) => !keep.has(item.recipeId)).map((item) => item.recipeId);
  if (extra.length > 0) {
    await requireSupabase().from("recipe_visits").delete().eq("user_id", userId).in("recipe_id", extra);
  }
}
