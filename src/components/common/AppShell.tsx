import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChefHat, House, UserRound, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useLocale } from "../../i18n/locale";
import { playerLevelFromClears } from "../../lib/playerLevel";
import { isSupabaseConfigured } from "../../lib/supabase";
import { flushPendingCookingSave, sumCompletedCookingStars } from "../../services/historyService";
import { mergeRecipeVisits } from "../../services/recipeVisitService";
import { getTechniqueProgress } from "../../services/techniqueService";
import { RecommendPrompt } from "./RecommendPrompt";

export function AppShell() {
  const location = useLocation();
  const { configured, user } = useAuth();
  const { locale, t } = useLocale();
  const [cleared, setCleared] = useState(0);
  const [cookingStars, setCookingStars] = useState(0);
  const isAuthPage = location.pathname.startsWith("/login") || location.pathname.startsWith("/signup");
  const isLessonPage =
    location.pathname.startsWith("/cook/") || /^\/techniques\/[^/]+/.test(location.pathname);
  const hideTabs = isAuthPage || isLessonPage;
  const player = playerLevelFromClears(cleared, cookingStars);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setCleared(0);
      setCookingStars(0);
      return;
    }
    let active = true;
    void (async () => {
      try {
        await flushPendingCookingSave(user.id);
      } catch {
        // Pending cook save is retried on the next signed-in visit.
      }
      if (!active) return;
      try {
        const [rows, stars] = await Promise.all([
          getTechniqueProgress(user.id),
          sumCompletedCookingStars(user.id),
        ]);
        if (!active) return;
        setCleared(rows.filter((row) => row.status === "cleared").length);
        setCookingStars(stars);
      } catch {
        if (active) {
          setCleared(0);
          setCookingStars(0);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [user, location.pathname]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    void mergeRecipeVisits(user.id, locale).catch(() => undefined);
  }, [user, locale]);

  const tabs = [
    { to: "/", label: t("navHome"), icon: House, end: true },
    { to: "/techniques", label: t("navTechniques"), icon: ChefHat },
    { to: "/recipes", label: t("navRecipes"), icon: UtensilsCrossed },
    { to: "/profile", label: t("navProfile"), icon: UserRound },
  ];

  return (
    <div className="flex min-h-[100dvh] min-w-0 flex-col overflow-x-clip bg-canvas text-ink">
      {!configured ? (
        <div className="bg-accent px-4 py-2 text-center text-sm text-white">
          {t("loginNeedSupabase")}
        </div>
      ) : null}
      <header className="sticky top-0 z-20 border-b border-line bg-card/95 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 max-w-lg items-center justify-between gap-3 px-4">
          <Link to="/" className="min-w-0 truncate text-sm font-black tracking-tight">
            Cooking Pass
          </Link>
          {user ? (
            <Link to="/profile" className="xp-chip max-w-[62%] shrink-0 overflow-hidden whitespace-nowrap" aria-label={t("navProfile")}>
              <span className="text-accent">{t("profileLevel", { n: player.level })}</span>
              <span className="hidden text-muted min-[360px]:inline">
                {t("profileXp", { current: player.xpInLevel, next: player.xpToNext })}
              </span>
            </Link>
          ) : (
            <Link to="/login" className="shrink-0 text-sm font-bold text-accent">
              {t("headerLogin")}
            </Link>
          )}
        </div>
      </header>
      <div className={hideTabs ? "min-w-0 flex-1" : "min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"}>
        <Outlet />
      </div>
      {isAuthPage ? null : <RecommendPrompt />}
      {hideTabs ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_-6px_0_rgb(184_214_194_/_0.85)] backdrop-blur-sm">
          <ul className="mx-auto grid max-w-lg grid-cols-4">
            {tabs.map((tab) => (
              <li key={tab.to} className="min-w-0">
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs font-bold ${
                      isActive ? "text-accent" : "text-muted"
                    }`
                  }
                >
                  <tab.icon className="h-5 w-5 shrink-0" strokeWidth={2.2} />
                  <span className="max-w-full truncate">{tab.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
