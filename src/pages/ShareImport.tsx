import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorState, PageLoader } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import { importSharedRecipe } from "../services/userRecipeService";

function importMessage(err: unknown, fallback: string, own: string): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("own recipe")) return own;
  if (message.includes("Invalid") || message.includes("not found") || message.includes("InvalidShareCode")) {
    return fallback;
  }
  return message || fallback;
}

export function ShareImport() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLocale();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    importSharedRecipe(decodeURIComponent(code))
      .then((id) => {
        if (active) navigate(`/saved/${id}`, { replace: true });
      })
      .catch((err: unknown) => {
        if (active) setError(importMessage(err, t("savedRecipeImportError"), t("savedRecipeImportOwn")));
      });
    return () => {
      active = false;
    };
  }, [user, code, navigate, t]);

  if (error) {
    return (
      <main className="page">
        <ErrorState message={error} />
        <Link to="/profile" className="mt-4 inline-block text-sm font-medium text-accent">
          {t("navProfile")}
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <PageLoader label={t("savedRecipeImporting")} />
    </main>
  );
}
