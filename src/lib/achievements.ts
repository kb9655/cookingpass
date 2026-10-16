export const GUEST_COOK_COUNT_KEY = "cookingpass:guest-cook-count";

export const ACHIEVEMENT_IDS = [
  "firstCook",
  "cook5",
  "cook10",
  "unique3",
  "star4",
  "skill1",
  "skill3",
  "journal1",
  "saved1",
  "worldClear",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];

export type AchievementStats = {
  cookCount: number;
  uniqueRecipes: number;
  maxStarCooked: number;
  skillsCleared: number;
  journalPhotos: number;
  savedRecipes: number;
  unlockedWorld: number;
};

export type AchievementResult = {
  id: AchievementId;
  unlocked: boolean;
  current: number;
  target: number;
};

export function loadGuestCookCount(): number {
  try {
    const raw = localStorage.getItem(GUEST_COOK_COUNT_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

export function bumpGuestCookCount(): number {
  const next = loadGuestCookCount() + 1;
  try {
    localStorage.setItem(GUEST_COOK_COUNT_KEY, String(next));
  } catch {
    // Ignore quota / private-mode failures.
  }
  return next;
}

const TARGETS: Record<AchievementId, (stats: AchievementStats) => { current: number; target: number }> = {
  firstCook: (stats) => ({ current: stats.cookCount, target: 1 }),
  cook5: (stats) => ({ current: stats.cookCount, target: 5 }),
  cook10: (stats) => ({ current: stats.cookCount, target: 10 }),
  unique3: (stats) => ({ current: stats.uniqueRecipes, target: 3 }),
  star4: (stats) => ({ current: stats.maxStarCooked >= 4 ? 1 : 0, target: 1 }),
  skill1: (stats) => ({ current: stats.skillsCleared, target: 1 }),
  skill3: (stats) => ({ current: stats.skillsCleared, target: 3 }),
  journal1: (stats) => ({ current: stats.journalPhotos, target: 1 }),
  saved1: (stats) => ({ current: stats.savedRecipes, target: 1 }),
  worldClear: (stats) => ({ current: stats.unlockedWorld >= 2 ? 1 : 0, target: 1 }),
};

export function evaluateAchievements(stats: AchievementStats): AchievementResult[] {
  return ACHIEVEMENT_IDS.map((id) => {
    const { current, target } = TARGETS[id](stats);
    return { id, current, target, unlocked: current >= target };
  });
}
