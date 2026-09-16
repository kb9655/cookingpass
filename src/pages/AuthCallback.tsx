import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageLoader } from "../components/common/Feedback";
import { useLocale } from "../i18n/locale";
import { consumeAuthReturnTo } from "../lib/authRedirect";
import { requireSupabase } from "../lib/supabase";

export function AuthCallback() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const providerError = params.get("error_description") ?? params.get("error");
      if (providerError) throw new Error(providerError);

      const client = requireSupabase();
      const {
        data: { session: existingSession },
      } = await client.auth.getSession();

      let session = existingSession;
      const code = params.get("code");
      if (!session && code) {
        const { data, error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        session = data.session;
      }

      if (!session) {
        throw new Error(t("authCallbackFailed"));
      }

      if (!active) return;
      sessionStorage.setItem("cookingpass:just-logged-in", "1");
      navigate(consumeAuthReturnTo(), { replace: true });
    })().catch((err: unknown) => {
      if (active) {
        setError(err instanceof Error ? err.message : t("authCallbackFailed"));
      }
    });

    return () => {
      active = false;
    };
  }, [navigate, t]);

  return (
    <main className="page">
      {error ? (
        <div className="card-casual mt-12 p-5">
          <h1 className="text-xl font-semibold">{t("authCallbackFailedTitle")}</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <Link to="/login" className="btn-primary mt-5 inline-flex">
            {t("authCallbackBack")}
          </Link>
        </div>
      ) : (
        <PageLoader label={t("authCallbackLoading")} />
      )}
    </main>
  );
}
