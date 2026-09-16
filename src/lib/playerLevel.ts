export const XP_PER_CLEAR = 100;
export const XP_PER_STAR = 10;
export const XP_PER_LEVEL = 200;

export type PlayerLevel = {
  level: number;
  totalXp: number;
  xpInLevel: number;
  xpToNext: number;
  barPercent: number;
};

export function cookingXpFromDifficulty(difficulty: number): number {
  const stars = Math.max(1, Math.round(Number.isFinite(difficulty) ? difficulty : 1));
  return stars * XP_PER_STAR;
}

export function playerLevelFromXp(totalXp: number): PlayerLevel {
  const safe = Math.max(0, Math.floor(totalXp));
  const level = Math.floor(safe / XP_PER_LEVEL) + 1;
  const xpInLevel = safe % XP_PER_LEVEL;
  return {
    level,
    totalXp: safe,
    xpInLevel,
    xpToNext: XP_PER_LEVEL,
    barPercent: Math.round((xpInLevel / XP_PER_LEVEL) * 100),
  };
}

export function playerLevelFromClears(cleared: number, cookingStars = 0): PlayerLevel {
  const safeCleared = Math.max(0, Math.floor(cleared));
  const safeStars = Math.max(0, Math.floor(cookingStars));
  return playerLevelFromXp(safeCleared * XP_PER_CLEAR + safeStars * XP_PER_STAR);
}
