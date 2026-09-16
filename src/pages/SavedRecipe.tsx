import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ErrorState, PageLoader } from "../components/common/Feedback";
import { AdjustedRecipeView } from "../components/recipe/AdjustedRecipeView";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { sharePath } from "../lib/shareCode";
import { startCookingFromSaved } from "../services/aiService";
import {
  deleteUserRecipe,
  ensureShareCode,
  getUserRecipe,
} from "../services/userRecipeService";
import type { SavedUserRecipe } from "../types/recipe";

export function SavedRecipe() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const [recipe, setRecipe] = useState<SavedUserRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    getUserRecipe(user.id, id)
      .then((next) => {
        if (!active) return;
        setRecipe(next);
        setShareCode(next?.shareCode ?? null);
        if (!next) setError(t("savedRecipeNotFound"));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : t("savedRecipeLoadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, id, t]);

  async function createShareCode() {
    if (!recipe) return;
    setError("");
    setSharing(true);
    try {
      const code = await ensureShareCode(recipe.id);
      setShareCode(code);
      setRecipe({ ...recipe, shareCode: code });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("savedRecipeLoadError"));
    } finally {
      setSharing(false);
    }
  }

  async function copyText(value: string, kind: "code" | "link") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  }

  function cookAgain() {
    if (!recipe) return;
    startCookingFromSaved(recipe.sourceRecipeId, recipe.payload);
    navigate(`/cook/${recipe.sourceRecipeId}`);
  }

  async function remove() {
    if (!user || !recipe) return;
    setDeleting(true);
    try {
      await deleteUserRecipe(user.id, recipe.id);
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("savedRecipeLoadError"));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <PageLoader label={t("pageLoading")} />
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="page">
        <ErrorState message={error || t("savedRecipeNotFound")} />
        <Link to="/profile" className="mt-4 inline-block text-sm font-medium text-accent">
          {t("navProfile")}
        </Link>
      </main>
    );
  }

  const shareUrl = shareCode ? `${window.location.origin}${sharePath(shareCode)}` : "";

  return (
    <main className="page pb-8">
      <p className="text-xs font-medium text-muted">{t("profileSavedRecipes")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight break-keep">{recipe.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {new Date(recipe.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR")}
      </p>

      <div className="card-casual mt-6 p-5">
        <AdjustedRecipeView recipe={recipe.payload} />
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      {shareCode ? (
        <div className="card-casual mt-4 p-5">
          <p className="text-sm font-medium">{t("profileImportCode")}</p>
          <p className="mt-2 font-mono text-2xl font-black tracking-wide">{shareCode}</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => void copyText(shareCode, "code")}
            >
              {copied === "code" ? t("savedRecipeShareCopied") : t("savedRecipeShareCopy")}
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => void copyText(shareUrl, "link")}
            >
              {copied === "link" ? t("savedRecipeShareCopied") : t("savedRecipeShareLinkCopy")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn-secondary mt-4 w-full"
          disabled={sharing}
          onClick={() => void createShareCode()}
        >
          {sharing ? t("pageLoading") : t("savedRecipeShare")}
        </button>
      )}

      <button type="button" className="btn-primary mt-4 w-full" onClick={cookAgain}>
        {t("savedRecipeCook")}
      </button>
      <button type="button" className="btn-secondary mt-2 w-full" onClick={() => setDeleteOpen(true)}>
        {t("savedRecipeDelete")}
      </button>
      <Link to="/profile" className="mt-4 inline-block text-sm font-medium text-accent">
        {t("navProfile")}
      </Link>

      {deleteOpen ? (
        <ConfirmDialog
          title={t("savedRecipeDeleteConfirm")}
          confirmLabel={deleting ? t("savedRecipeDeleting") : t("savedRecipeDelete")}
          busy={deleting}
          onConfirm={() => void remove()}
          onClose={() => {
            if (!deleting) setDeleteOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
