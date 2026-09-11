import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useLocale } from "../../i18n/locale";
import { listUserIngredients } from "../../services/ingredientService";
import { listScoredRecipes } from "../../services/recipeService";
import { getTechniqueProgress } from "../../services/techniqueService";
import { loadCookingDraft } from "../../services/aiService";
import { isSupabaseConfigured } from "../../lib/supabase";
import type { ScoredRecipe } from "../../types/recipe";
import { RecommendDialog } from "./RecommendDialog";

const LAST_SHOWN_KEY = "cookingpass:rec-popup-at";
const SESSION_SHOWN_KEY = "cookingpass:rec-shown";
const JUST_LOGIN_KEY = "cookingpass:just-logged-in";
const DAY_MS = 24 * 60 * 60 * 1000;

function blockedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/cook/")
  );
}

function markShown(userId: string) {
  sessionStorage.setItem(`${SESSION_SHOWN_KEY}:${userId}`, "1");
  localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
}

export function RecommendPrompt() {
  const location = useLocation();
  const { user, profile, loading } = useAuth();
  const { locale } = useLocale();
  const [mode, setMode] = useState<"hidden" | "resume" | "recommend">("hidden");
  const [recipes, setRecipes] = useState<ScoredRecipe[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftRecipeId, setDraftRecipeId] = useState("");
  const [draftProgress, setDraftProgress] = useState("");

  useEffect(() => {
    if (loading || !user || !isSupabaseConfigured) return;

    const justLoggedIn = sessionStorage.getItem(JUST_LOGIN_KEY) === "1";
    if (blockedPath(location.pathname)) {
      if (justLoggedIn && location.pathname.startsWith("/cook/")) {
        sessionStorage.removeItem(JUST_LOGIN_KEY);
      }
      return;
    }

    const lastAt = Number(localStorage.getItem(LAST_SHOWN_KEY) || "0");
    const dueByCooldown = Date.now() - lastAt >= DAY_MS;
    const shownThisSession = Boolean(sessionStorage.getItem(`${SESSION_SHOWN_KEY}:${user.id}`));
    if (!justLoggedIn && !dueByCooldown) return;
    if (shownThisSession && !justLoggedIn && !dueByCooldown) return;

    if (justLoggedIn) sessionStorage.removeItem(JUST_LOGIN_KEY);
    markShown(user.id);

    const draft = loadCookingDraft();
    if (draft) {
      setDraftTitle(draft.recipe.title);
      setDraftRecipeId(draft.recipeId);
      setDraftProgress(`${draft.progressIndex + 1}/${draft.recipe.steps.length}`);
      setMode("resume");
      return;
    }

    Promise.all([listUserIngredients(locale), getTechniqueProgress(user.id)])
      .then(([pantry, progress]) =>
        listScoredRecipes({
          locale,
          progress,
          pantry,
          experienceLevel: profile?.experience_level ?? "beginner",
          preferredMaxMinutes: profile?.preferred_max_minutes ?? null,
          availableTools: profile?.available_tools ?? [],
          focusTechniqueId: null,
        }),
      )
      .then((scored) => {
        const top = scored.slice(0, 3);
        if (top.length === 0) return;
        setRecipes(top);
        setMode("recommend");
      })
      .catch(() => {
        // Keep browsing if recommendations fail to load.
      });
  }, [user, profile, loading, locale, location.pathname]);

  if (mode === "hidden") return null;

  return (
    <RecommendDialog
      mode={mode}
      recipes={recipes}
      resumeTitle={draftTitle}
      resumeRecipeId={draftRecipeId}
      resumeProgress={draftProgress}
      onClose={() => setMode("hidden")}
    />
  );
}
