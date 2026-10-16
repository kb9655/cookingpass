import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChefHat, House, Trophy, UserRound, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useViewMode } from "../../hooks/useViewMode";
import { useLocale } from "../../i18n/locale";
import { playerLevelFromClears } from "../../lib/playerLevel";
import { isSupabaseConfigured } from "../../lib/supabase";
import { flushPendingCookingSave, sumCompletedCookingStars } from "../../services/historyService";
import { mergeRecipeVisits } from "../../services/recipeVisitService";
import { getTechniqueProgress } from "../../services/techniqueService";
import { EmergencyChat } from "../chat/EmergencyChat";
import { EmergencyChatProvider } from "../chat/EmergencyChatProvider";
import { RecommendPrompt } from "./RecommendPrompt";

export function AppShell() {
  const location = useLocation();
  const { configured, user } = useAuth();
  const { locale, t } = useLocale();
  const { mode, toggle } = useViewMode();
  const [cleared, setCleared] = useState(0);
  const [cookingStars, setCookingStars] = useState(0);
  const [xpReady, setXpReady] = useState(false);
  const [chipFx, setChipFx] = useState<"gain" | "level" | "">("");
  const prevXpRef = useRef({ xp: 0, level: 1, primed: false });
  const isAuthPage =
    location.pathname.startsWith("/login") || location.pathname.startsWith("/signup");
  const isLessonPage =
    location.pathname.startsWith("/cook/") || /^\/techniques\/[^/]+/.test(location.pathname);
  const hideTabs = isAuthPage || isLessonPage;
  const player = playerLevelFromClears(cleared, cookingStars);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setCleared(0);
      setCookingStars(0);
      setXpReady(false);
      prevXpRef.current = { xp: 0, level: 1, primed: false };
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
        setXpReady(true);
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
    if (!xpReady) return;
    const prev = prevXpRef.current;
    if (!prev.primed) {
      prevXpRef.current = { xp: player.totalXp, level: player.level, primed: true };
      return;
    }
    const xpUp = player.totalXp > prev.xp;
    const levelUp = player.level > prev.level;
    prevXpRef.current = { xp: player.totalXp, level: player.level, primed: true };
    if (!xpUp && !levelUp) return;
    setChipFx(levelUp ? "level" : "gain");
    const id = window.setTimeout(() => setChipFx(""), 1400);
    return () => window.clearTimeout(id);
  }, [xpReady, player.totalXp, player.level]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    void mergeRecipeVisits(user.id, locale).catch(() => undefined);
  }, [user, locale]);

  const tabs = [
    { to: "/", label: t("navHome"), icon: House, end: true },
    { to: "/techniques", label: t("navTechniques"), icon: ChefHat },
    { to: "/recipes", label: t("navRecipes"), icon: UtensilsCrossed },
    { to: "/achievements", label: t("navAchievements"), icon: Trophy },
    { to: "/profile", label: t("navProfile"), icon: UserRound },
  ];

  return (
    <EmergencyChatProvider>
      <div className="app-shell flex min-h-[100dvh] min-w-0 flex-col overflow-x-clip bg-canvas text-ink">
        {!configured ? (
          <div className="bg-accent px-4 py-2 text-center text-sm text-white">
            {t("loginNeedSupabase")}
          </div>
        ) : null}
        <header className="sticky top-0 z-20 border-b border-line bg-card/95 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-sm">
          <div className="shell-bar mx-auto flex min-h-16 max-w-lg items-center justify-between gap-3 px-4">
            <Link to="/" className="min-w-0 truncate text-sm font-black tracking-tight">
              Cooking Pass
            </Link>
            <div className="flex min-w-0 shrink-0 items-center gap-2">
            <button
              type="button"
              className="xp-chip shrink-0"
              aria-pressed={mode === "landscape"}
              onClick={toggle}
            >
              {mode === "landscape" ? t("viewPortrait") : t("viewLandscape")}
            </button>
            {user ? (
              <Link
                to="/profile"
                className={`xp-chip shrink-0 whitespace-nowrap ${
                  chipFx === "level" ? "xp-chip-level" : chipFx === "gain" ? "xp-chip-gain" : ""
                }`}
                aria-label={t("navProfile")}
              >
                <span className="text-accent">{t("profileLevelShort", { n: player.level })}</span>
                <span className={chipFx === "level" ? "text-white" : "text-muted"}>
                  {t("profileXp", { current: player.xpInLevel, need: player.xpForLevel })}
                </span>
              </Link>
            ) : (
              <Link to="/login" className="shrink-0 text-sm font-bold text-accent">
                {t("headerLogin")}
              </Link>
            )}
            </div>
          </div>
        </header>
        <div
          className={
            hideTabs ? "shell-main min-w-0 flex-1" : "shell-main min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
          }
        >
          <Outlet />
        </div>
        {isAuthPage ? null : <RecommendPrompt />}
        {hideTabs ? null : (
          <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_-6px_0_rgb(184_214_194_/_0.85)] backdrop-blur-sm">
            <ul className="shell-tabs mx-auto grid max-w-lg grid-cols-5">
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
        <EmergencyChat />
      </div>
    </EmergencyChatProvider>
  );
}
