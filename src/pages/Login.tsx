import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LanguageToggle } from "../components/common/LanguageToggle";
import { useAuth, type SocialProvider } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";

export function Login() {
  const { user, signIn, signInWithSocial, configured } = useAuth();
  const { t } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [socialProvider, setSocialProvider] = useState<SocialProvider | null>(null);

  if (user) return <Navigate to={from === "/login" ? "/" : from} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
      sessionStorage.setItem("cookingpass:just-logged-in", "1");
      navigate(from === "/login" ? "/" : from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loginFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSocialSignIn(provider: SocialProvider) {
    setError("");
    setSocialProvider(provider);
    try {
      await signInWithSocial(provider, from);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("socialLoginFailed"));
      setSocialProvider(null);
    }
  }

  return (
    <main className="page">
      <LanguageToggle />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("loginTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("loginLead")}</p>
      <div className="mt-8 grid gap-3">
        <button
          type="button"
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:bg-canvas disabled:opacity-60"
          disabled={!configured || Boolean(socialProvider) || submitting}
          onClick={() => void onSocialSignIn("google")}
        >
          <span className="grid size-6 place-items-center rounded-full border border-line text-xs font-black text-[#4285f4]">
            G
          </span>
          {socialProvider === "google" ? t("socialLoginConnecting") : t("socialLoginGoogle")}
        </button>
      </div>
      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-bold text-muted">{t("socialLoginOr")}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">{t("loginEmail")}</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t("loginPassword")}</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {!configured ? <p className="text-sm text-muted">{t("loginNeedSupabase")}</p> : null}
        <button
          className="btn-primary w-full"
          type="submit"
          disabled={submitting || Boolean(socialProvider) || !configured}
        >
          {submitting ? t("loginSubmitting") : t("loginSubmit")}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {t("loginNoAccount")}{" "}
        <Link to="/signup" className="font-semibold text-accent">
          {t("loginSignup")}
        </Link>
      </p>
    </main>
  );
}
