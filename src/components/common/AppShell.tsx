import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Carrot, ChefHat, House, UserRound, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useLocale } from "../../i18n/locale";
import { RecommendPrompt } from "./RecommendPrompt";

export function AppShell() {
  const location = useLocation();
  const { configured, user, profile } = useAuth();
  const { t } = useLocale();
  const hideChrome =
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/signup") ||
    location.pathname.startsWith("/cook/") ||
    /^\/techniques\/[^/]+/.test(location.pathname);

  const tabs = [
    { to: "/", label: t("navHome"), icon: House, end: true },
    { to: "/techniques", label: t("navTechniques"), icon: ChefHat },
    { to: "/recipes", label: t("navRecipes"), icon: UtensilsCrossed },
    { to: "/ingredients", label: t("navIngredients"), icon: Carrot },
    { to: "/profile", label: t("navProfile"), icon: UserRound },
  ];

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink">
      {!configured ? (
        <div className="bg-accent px-4 py-2 text-center text-sm text-white">
          {t("loginNeedSupabase")}
        </div>
      ) : null}
      {hideChrome ? null : (
        <header className="sticky top-0 z-20 border-b border-line bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
            <Link to="/" className="text-sm font-semibold">
              Cooking Pass
            </Link>
            {user ? (
              <Link to="/profile" className="text-sm font-medium text-accent">
                {profile?.display_name ?? t("navProfile")}
              </Link>
            ) : (
              <Link to="/login" className="text-sm font-semibold text-accent">
                {t("headerLogin")}
              </Link>
            )}
          </div>
        </header>
      )}
      <div className={hideChrome ? "" : "pb-24"}>
        <Outlet />
      </div>
      {hideChrome ? null : <RecommendPrompt />}
      {hideChrome ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
          <ul className="mx-auto grid max-w-lg grid-cols-5">
            {tabs.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                      isActive ? "text-accent" : "text-muted"
                    }`
                  }
                >
                  <tab.icon className="h-5 w-5" strokeWidth={1.75} />
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
