import type { ParsedRecipeRecord } from "../data/parseRecipeCsv";
import type { ScoredRecipe } from "../types/recipe";

export const FRIDGE_KEYWORDS_KEY = "cookingpass:fridge-keywords";
export const MAX_FRIDGE_KEYWORDS = 2;

export type UseUpRecipe = ScoredRecipe & { matchedIngredients: string[] };

export function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function tokenizeFridgeInput(raw: string): string[] {
  return raw
    .split(/[\s,，、]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function loadFridgeKeywords(): string[] {
  try {
    const raw = localStorage.getItem(FRIDGE_KEYWORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_FRIDGE_KEYWORDS);
  } catch {
    return [];
  }
}

export function saveFridgeKeywords(keywords: string[]): void {
  try {
    localStorage.setItem(FRIDGE_KEYWORDS_KEY, JSON.stringify(keywords.slice(0, MAX_FRIDGE_KEYWORDS)));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function addFridgeKeywords(
  current: string[],
  incoming: string[],
): { next: string[]; ignored: boolean } {
  const next = [...current];
  let ignored = false;
  for (const item of incoming) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = normalizeKeyword(trimmed);
    if (!key) continue;
    if (next.some((existing) => normalizeKeyword(existing) === key)) continue;
    if (next.length >= MAX_FRIDGE_KEYWORDS) {
      ignored = true;
      continue;
    }
    next.push(trimmed);
  }
  return { next, ignored };
}

const KEYWORD_ALIASES: Record<string, string[]> = {
  달걀: ["계란", "에그", "egg", "eggs"],
  계란: ["달걀", "에그", "egg", "eggs"],
  에그: ["달걀", "계란", "egg", "eggs"],
  egg: ["eggs", "달걀", "계란", "에그"],
  eggs: ["egg", "달걀", "계란", "에그"],
  양파: ["onion", "onions"],
  onion: ["onions", "양파"],
  onions: ["onion", "양파"],
  시금치: ["spinach"],
  spinach: ["시금치"],
  감자: ["potato", "potatoes"],
  potato: ["potatoes", "감자"],
  potatoes: ["potato", "감자"],
};

function keywordNeedles(keyword: string): string[] {
  const primary = normalizeKeyword(keyword);
  if (!primary) return [];
  const extras = KEYWORD_ALIASES[primary] ?? [];
  return [primary, ...extras.map(normalizeKeyword)];
}

export function ingredientMatchesKeyword(name: string, keyword: string): boolean {
  const haystack = normalizeKeyword(name);
  if (!haystack) return false;
  return keywordNeedles(keyword).some((needle) => needle && haystack.includes(needle));
}

function matchedNames(names: string[], keywords: string[]): string[] {
  const hits: string[] = [];
  for (const keyword of keywords) {
    const name = names.find((item) => ingredientMatchesKeyword(item, keyword));
    if (name && !hits.includes(name)) hits.push(name);
  }
  return hits;
}

function keywordHitCount(names: string[], keywords: string[]): number {
  return keywords.filter((keyword) => names.some((name) => ingredientMatchesKeyword(name, keyword))).length;
}

export function rankUseUpRecipes(records: ParsedRecipeRecord[], keywords: string[]): UseUpRecipe[] {
  const query = keywords.map((item) => item.trim()).filter(Boolean).slice(0, MAX_FRIDGE_KEYWORDS);
  if (query.length === 0) return [];

  const ranked = records
    .map((record) => {
      const names = record.ingredients.map((item) => item.name).filter(Boolean);
      const searchNames = [...names, record.recipe.name, record.recipe.description].filter(Boolean);
      const hits = keywordHitCount(searchNames, query);
      if (hits === 0) return null;
      const matchedIngredients = matchedNames(names, query);
      const labels = matchedIngredients.length ? matchedIngredients : query.filter((keyword) => keywordHitCount(searchNames, [keyword]));
      const useRatio = matchedIngredients.length / Math.max(1, names.length);
      const difficultyTie = Math.max(0, 1 - record.recipe.difficulty / 5) * 0.04;
      const timeTie = record.recipe.estimated_minutes <= 30 ? 0.03 : Math.max(0, 0.03 - record.recipe.estimated_minutes / 2000);
      const allMatched = hits === query.length ? 1 : 0;
      const score = allMatched * 2 + useRatio + difficultyTie + timeTie;
      const recipe: UseUpRecipe = {
        ...record.recipe,
        score,
        skill_match: 0,
        pantry_coverage: useRatio,
        difficulty_fit: difficultyTie,
        time_fit: timeTie,
        tool_fit: 0,
        relatedness: allMatched,
        ingredient_names: names,
        matchedIngredients: labels,
      };
      return recipe;
    })
    .filter((item): item is UseUpRecipe => Boolean(item));

  return ranked.sort((a, b) => {
    if (b.relatedness !== a.relatedness) return b.relatedness - a.relatedness;
    if (b.pantry_coverage !== a.pantry_coverage) return b.pantry_coverage - a.pantry_coverage;
    return b.score - a.score;
  });
}
