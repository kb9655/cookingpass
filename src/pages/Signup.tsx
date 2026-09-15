import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { LanguageToggle } from "../components/common/LanguageToggle";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";

export function Signup() {
  const { user, signUp, configured } = useAuth();
  const { t } = useLocale();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await signUp(email, password, displayName);
      setMessage(t("signupDone"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signupFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page page-notch">
      <LanguageToggle />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("signupTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("signupLead")}</p>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="displayName">{t("signupName")}</label>
          <input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </div>
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
            autoComplete="new-password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm text-accent">{message}</p> : null}
        <button className="btn-primary w-full" type="submit" disabled={submitting || !configured}>
          {submitting ? t("signupSubmitting") : t("signupSubmit")}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        {t("signupHasAccount")}{" "}
        <Link to="/login" className="font-semibold text-accent">
          {t("signupLogin")}
        </Link>
      </p>
    </main>
  );
}
