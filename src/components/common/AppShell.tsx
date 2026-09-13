import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ChefHat, House, UserRound, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useLocale } from "../../i18n/locale";
import { playerLevelFromClears } from "../../lib/playerLevel";
import { isSupabaseConfigured } from "../../lib/supabase";
import { getTechniqueProgress } from "../../services/techniqueService";
import { RecommendPrompt } from "./RecommendPrompt";

export function AppShell() {
  const location = useLocation();
  const { configured, user } = useAuth();
  const { t } = useLocale();
  const [cleared, setCleared] = useState(0);
  const isAuthPage = location.pathname.startsWith("/login") || location.pathname.startsWith("/signup");
  const isLessonPage =
    location.pathname.startsWith("/cook/") || /^\/techniques\/[^/]+/.test(location.pathname);
  const hideTabs = isAuthPage || isLessonPage;
  const player = playerLevelFromClears(cleared);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setCleared(0);
      return;
    }
    let active = true;
    getTechniqueProgress(user.id)
      .then((rows) => {
        if (active) setCleared(rows.filter((row) => row.status === "cleared").length);
      })
      .catch(() => {
        if (active) setCleared(0);
      });
    return () => {
      active = false;
    };
  }, [user, location.pathname]);

  const tabs = [
    { to: "/", label: t("navHome"), icon: House, end: true },
    { to: "/techniques", label: t("navTechniques"), icon: ChefHat },
    { to: "/recipes", label: t("navRecipes"), icon: UtensilsCrossed },
    { to: "/profile", label: t("navProfile"), icon: UserRound },
  ];

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink">
      {!configured ? (
        <div className="bg-accent px-4 py-2 text-center text-sm text-white">
          {t("loginNeedSupabase")}
        </div>
      ) : null}
      {isAuthPage ? null : (
        <header className="sticky top-0 z-20 border-b border-line bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
            <Link to="/" className="text-sm font-black tracking-tight">
              Cooking Pass
            </Link>
            {user ? (
              <Link to="/profile" className="xp-chip whitespace-nowrap" aria-label={t("navProfile")}>
                <span className="text-accent">{t("profileLevel", { n: player.level })}</span>
                <span className="text-muted">
                  {t("profileXp", { current: player.xpInLevel, next: player.xpToNext })}
                </span>
              </Link>
            ) : (
              <Link to="/login" className="text-sm font-bold text-accent">
                {t("headerLogin")}
              </Link>
            )}
          </div>
        </header>
      )}
      <div className={hideTabs ? "" : "pb-24"}>
        <Outlet />
      </div>
      {isAuthPage ? null : <RecommendPrompt />}
      {hideTabs ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_0_rgb(184_214_194_/_0.85)] backdrop-blur-sm">
          <ul className="mx-auto grid max-w-lg grid-cols-4">
            {tabs.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${
                      isActive ? "text-accent" : "text-muted"
                    }`
                  }
                >
                  <tab.icon className="h-5 w-5" strokeWidth={2.2} />
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
