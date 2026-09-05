import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Carrot, ChefHat, House, UserRound, UtensilsCrossed } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const tabs = [
  { to: "/", label: "홈", icon: House, end: true },
  { to: "/techniques", label: "기술", icon: ChefHat },
  { to: "/recipes", label: "레시피", icon: UtensilsCrossed },
  { to: "/ingredients", label: "재료", icon: Carrot },
  { to: "/profile", label: "프로필", icon: UserRound },
];

export function AppShell() {
  const location = useLocation();
  const { configured } = useAuth();
  const hideNav =
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/signup") ||
    location.pathname.startsWith("/cook/");

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink">
      {!configured ? (
        <div className="bg-accent px-4 py-2 text-center text-sm text-white">
          레시피·재료는 로컬 데모 데이터입니다. Claude 조정은 `.env`의 `ANTHROPIC_API_KEY`가 필요합니다.
        </div>
      ) : null}
      <div className={hideNav ? "" : "pb-24"}>
        <Outlet />
      </div>
      {hideNav ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 backdrop-blur-sm">
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
