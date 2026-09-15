import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useLocale } from "../../i18n/locale";
import type { ScoredRecipe } from "../../types/recipe";
import { RecipeCard } from "../recipe/RecipeCard";

type RecommendDialogProps = {
  mode: "recommend" | "resume";
  recipes?: ScoredRecipe[];
  resumeTitle?: string;
  resumeRecipeId?: string;
  resumeProgress?: string;
  onClose: () => void;
};

export function RecommendDialog({
  mode,
  recipes = [],
  resumeTitle,
  resumeRecipeId,
  resumeProgress,
  onClose,
}: RecommendDialogProps) {
  const { t } = useLocale();

  return createPortal(
    <div className="dialog-overlay">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("recommendClose")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommend-dialog-title"
        className="relative z-10 max-h-[min(85dvh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-line bg-card p-5 shadow-lg"
      >
        {mode === "resume" ? (
          <>
            <h2 id="recommend-dialog-title" className="text-xl font-semibold">
              {t("resumeTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {t("resumeLead", {
                title: resumeTitle ?? "",
                progress: resumeProgress ?? "",
              })}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              {resumeRecipeId ? (
                <Link to={`/cook/${resumeRecipeId}`} className="btn-primary w-full" onClick={onClose}>
                  {t("resumeContinue")}
                </Link>
              ) : null}
              <button type="button" className="btn-secondary w-full" onClick={onClose}>
                {t("resumeDismiss")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="recommend-dialog-title" className="text-xl font-semibold">
              {t("recommendTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted">{t("recommendLead")}</p>
            <div className="mt-5 grid gap-3">
              {recipes.map((recipe) => (
                <div key={recipe.id} onClick={onClose}>
                  <RecipeCard recipe={recipe} />
                </div>
              ))}
            </div>
            <button type="button" className="btn-secondary mt-5 w-full" onClick={onClose}>
              {t("recommendClose")}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
