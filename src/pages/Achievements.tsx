import { useEffect, useState } from "react";
import {
  Bookmark,
  Camera,
  ChefHat,
  CookingPot,
  GraduationCap,
  LayoutGrid,
  Layers,
  Medal,
  Star,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { EmptyState, ErrorState, PageLoader } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import type { MessageKey } from "../i18n/messages";
import {
  evaluateAchievements,
  loadGuestCookCount,
  type AchievementId,
  type AchievementResult,
  type AchievementStats,
} from "../lib/achievements";
import { journalOwnerId, listJournalPhotos } from "../lib/journalStore";
import { loadGuestClearedRecipes } from "../lib/recipeWorlds";
import { isSupabaseConfigured } from "../lib/supabase";
import { countCompletedCooks, listCompletedRecipeMarks } from "../services/historyService";
import { getTechniqueProgress } from "../services/techniqueService";
import { listUserRecipes } from "../services/userRecipeService";

const TILES: Array<{
  id: AchievementId;
  icon: LucideIcon;
  title: MessageKey;
  body: MessageKey;
}> = [
  { id: "firstCook", icon: CookingPot, title: "achFirstCookTitle", body: "achFirstCookBody" },
  { id: "cook5", icon: UtensilsCrossed, title: "achCook5Title", body: "achCook5Body" },
  { id: "cook10", icon: Medal, title: "achCook10Title", body: "achCook10Body" },
  { id: "unique3", icon: LayoutGrid, title: "achUnique3Title", body: "achUnique3Body" },
  { id: "star4", icon: Star, title: "achStar4Title", body: "achStar4Body" },
  { id: "skill1", icon: ChefHat, title: "achSkill1Title", body: "achSkill1Body" },
  { id: "skill3", icon: GraduationCap, title: "achSkill3Title", body: "achSkill3Body" },
  { id: "journal1", icon: Camera, title: "achJournal1Title", body: "achJournal1Body" },
  { id: "saved1", icon: Bookmark, title: "achSaved1Title", body: "achSaved1Body" },
  { id: "unique5", icon: Layers, title: "achUnique5Title", body: "achUnique5Body" },
];

export function Achievements() {
  const { user } = useAuth();
  const { t } = useLocale();
  const [rows, setRows] = useState<AchievementResult[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const guestMarks = loadGuestClearedRecipes();
        const photos = await listJournalPhotos(journalOwnerId(user?.id));
        let stats: AchievementStats = {
          cookCount: Math.max(loadGuestCookCount(), guestMarks.length),
          uniqueRecipes: guestMarks.length,
          maxStarCooked: guestMarks.reduce((max, item) => Math.max(max, item.difficulty), 0),
          skillsCleared: 0,
          journalPhotos: photos.length,
          savedRecipes: 0,
        };

        if (user && isSupabaseConfigured) {
          const [cookCount, marks, progress, saved] = await Promise.all([
            countCompletedCooks(user.id),
            listCompletedRecipeMarks(user.id),
            getTechniqueProgress(user.id),
            listUserRecipes(user.id).catch(() => []),
          ]);
          stats = {
            cookCount,
            uniqueRecipes: marks.length,
            maxStarCooked: marks.reduce((max, item) => Math.max(max, item.difficulty), 0),
            skillsCleared: progress.filter((item) => item.status === "cleared").length,
            journalPhotos: photos.length,
            savedRecipes: saved.length,
          };
        }

        if (!cancelled) setRows(evaluateAchievements(stats));
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("achLoadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, t, reloadToken]);

  const unlockedCount = rows.filter((item) => item.unlocked).length;

  return (
    <main className="page">
      <h1 className="text-3xl font-black tracking-tight">{t("achTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("achLead")}</p>
      {loading ? null : (
        <p className="mt-2 text-sm font-bold text-accent">{t("achProgress", { n: unlockedCount, total: TILES.length })}</p>
      )}

      {error ? (
        <div className="mt-6">
          <ErrorState message={error} onRetry={() => setReloadToken((current) => current + 1)} />
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <PageLoader label={t("pageLoading")} />
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="mt-6">
          <EmptyState title={t("achEmptyTitle")} body={t("achEmptyBody")} />
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3">
          {TILES.map((tile) => {
            const result = rows.find((item) => item.id === tile.id);
            const unlocked = Boolean(result?.unlocked);
            const Icon = tile.icon;
            return (
              <li key={tile.id}>
                <article
                  className={
                    unlocked
                      ? "card-casual flex min-h-40 flex-col p-3"
                      : "flex min-h-40 flex-col rounded-[2rem] border border-line bg-ink/90 p-3 text-white grayscale"
                  }
                >
                  <Icon
                    className={`h-8 w-8 shrink-0 ${unlocked ? "text-accent" : "text-white/55"}`}
                    strokeWidth={2.2}
                  />
                  <p className={`mt-3 text-sm font-black break-keep ${unlocked ? "text-ink" : "text-white/80"}`}>
                    {t(tile.title)}
                  </p>
                  <p className={`mt-1 text-xs leading-snug ${unlocked ? "text-muted" : "text-white/50"}`}>
                    {t(tile.body)}
                  </p>
                  <p className={`mt-auto pt-2 text-xs font-bold ${unlocked ? "text-accent" : "text-white/40"}`}>
                    {unlocked
                      ? t("achUnlocked")
                      : t("achLocked", { current: result?.current ?? 0, need: result?.target ?? 1 })}
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
