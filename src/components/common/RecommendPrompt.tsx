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

const SESSION_SHOWN_KEY = "cookingpass:rec-shown";
const JUST_LOGIN_KEY = "cookingpass:just-logged-in";
const GUEST_SHOWN_KEY = `${SESSION_SHOWN_KEY}:guest`;

function blockedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/cook/")
  );
}

function markShown(key: string) {
  sessionStorage.setItem(key, "1");
}

function shownKey(userId?: string) {
  return userId ? `${SESSION_SHOWN_KEY}:${userId}` : GUEST_SHOWN_KEY;
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
    if (loading) return;
    if (blockedPath(location.pathname)) {
      const justLoggedIn = sessionStorage.getItem(JUST_LOGIN_KEY) === "1";
      if (justLoggedIn && location.pathname.startsWith("/cook/")) {
        sessionStorage.removeItem(JUST_LOGIN_KEY);
      }
      return;
    }

    const justLoggedIn = sessionStorage.getItem(JUST_LOGIN_KEY) === "1";
    const key = shownKey(user?.id);
    const shownThisSession = Boolean(sessionStorage.getItem(key));
    if (shownThisSession && !justLoggedIn) return;
    if (justLoggedIn) sessionStorage.removeItem(JUST_LOGIN_KEY);

    const draft = loadCookingDraft();
    if (draft) {
      markShown(key);
      const current = draft.onIntro ? 0 : draft.viewIndex + 1;
      setDraftTitle(draft.recipe.title);
      setDraftRecipeId(draft.recipeId);
      setDraftProgress(`${current}/${draft.recipe.steps.length}`);
      setMode("resume");
      return;
    }

    if (!user || !isSupabaseConfigured) return;

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
        markShown(shownKey(user.id));
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
