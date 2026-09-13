export const XP_PER_CLEAR = 100;
export const XP_PER_LEVEL = 200;

export type PlayerLevel = {
  level: number;
  totalXp: number;
  xpInLevel: number;
  xpToNext: number;
  barPercent: number;
};

export function playerLevelFromClears(cleared: number): PlayerLevel {
  const safeCleared = Math.max(0, Math.floor(cleared));
  const totalXp = safeCleared * XP_PER_CLEAR;
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXp % XP_PER_LEVEL;
  return {
    level,
    totalXp,
    xpInLevel,
    xpToNext: XP_PER_LEVEL,
    barPercent: Math.round((xpInLevel / XP_PER_LEVEL) * 100),
  };
}
