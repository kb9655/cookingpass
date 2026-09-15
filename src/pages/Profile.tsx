import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { getTechniqueProgress, listTechniques, resetAllTechniqueProgress } from "../services/techniqueService";
import { listCookingHistory } from "../services/historyService";
import { updateProfile } from "../services/profileService";
import { LanguageToggle } from "../components/common/LanguageToggle";
import { ProgressBar } from "../components/common/ProgressBar";
import { EmptyState, ErrorState, PageLoader } from "../components/common/Feedback";
import { useLocale } from "../i18n/locale";
import { playerLevelFromClears } from "../lib/playerLevel";
import type { Technique, TechniqueProgress } from "../types/technique";
import type { CookingHistory, ExperienceLevel } from "../types/user";

const TOOL_OPTIONS = ["칼", "도마", "프라이팬", "냄비", "주걱", "채칼"];

export function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { locale, t } = useLocale();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [progress, setProgress] = useState<TechniqueProgress[]>([]);
  const [history, setHistory] = useState<CookingHistory[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [experience, setExperience] = useState<ExperienceLevel>(profile?.experience_level ?? "beginner");
  const [tools, setTools] = useState<string[]>(profile?.available_tools ?? []);

  useEffect(() => {
    setExperience(profile?.experience_level ?? "beginner");
    setTools(profile?.available_tools ?? []);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([
      listTechniques(),
      getTechniqueProgress(user.id),
      listCookingHistory(user.id, locale),
    ])
      .then(([nextTechniques, nextProgress, nextHistory]) => {
        if (!active) return;
        setTechniques(nextTechniques);
        setProgress(nextProgress);
        setHistory(nextHistory);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : t("profileLoadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user, locale, t]);

  async function resetProgress() {
    if (!user) return;
    setError("");
    setResetting(true);
    try {
      await resetAllTechniqueProgress(user.id);
      const nextProgress = await getTechniqueProgress(user.id);
      setProgress(nextProgress);
      setResetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profileResetError"));
    } finally {
      setResetting(false);
    }
  }

  const cleared = progress.filter((item) => item.status === "cleared").length;
  const player = playerLevelFromClears(cleared);

  async function savePrefs() {
    if (!user) return;
    setError("");
    try {
      await updateProfile(user.id, {
        experience_level: experience,
        available_tools: tools,
      });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profileSaveError"));
    }
  }

  return (
    <main className="page pb-8">
      <h1 className="text-3xl font-black tracking-tight">{t("profileTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{profile?.display_name ?? user?.email}</p>

      {loading ? (
        <PageLoader label={t("pageLoading")} />
      ) : (
        <>
          <section className="card-casual mt-6 p-5">
            <p className="text-sm text-muted">{t("profileProgress")}</p>
            <p className="mt-1 text-2xl font-black">{t("profileLevel", { n: player.level })}</p>
            <p className="mt-1 text-sm text-muted">
              {t("profileXp", { current: player.xpInLevel, next: player.xpToNext })}
            </p>
            <ProgressBar value={player.barPercent} />
            <button
              type="button"
              className="btn-secondary mt-4 w-full"
              onClick={() => setResetOpen(true)}
            >
              {t("profileResetProgress")}
            </button>
            <ul className="mt-4 space-y-2 text-sm">
              {techniques.map((technique) => {
                const status =
                  progress.find((item) => item.technique_id === technique.id)?.status ?? "unlocked";
                const cleared = status === "cleared";
                return (
                  <li key={technique.id} className="flex items-center justify-between">
                    <span>{technique.name}</span>
                    <span className={cleared ? "text-accent" : "text-muted"}>
                      {cleared ? t("profileCleared") : t("profileUnlearned")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card-casual mt-6 p-5">
            <h2 className="text-lg font-black">{t("profileSettings")}</h2>
            <LanguageToggle className="mt-4" />
          </section>

          <section className="card-casual mt-6 p-5">
            <h2 className="text-lg font-black">{t("profileCooking")}</h2>
            <div className="field mt-4">
              <label htmlFor="experience">{t("profileExperience")}</label>
              <select
                id="experience"
                value={experience}
                onChange={(event) => setExperience(event.target.value as ExperienceLevel)}
              >
                <option value="beginner">{t("profileBeginner")}</option>
                <option value="intermediate">{t("profileIntermediate")}</option>
                <option value="advanced">{t("profileAdvanced")}</option>
              </select>
            </div>
            <p className="mt-4 text-sm font-medium">{t("profileTools")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TOOL_OPTIONS.map((tool) => {
                const active = tools.includes(tool);
                return (
                  <button
                    key={tool}
                    type="button"
                    className={`rounded-full px-3 py-1 text-sm ${
                      active ? "bg-accent text-white" : "border border-line"
                    }`}
                    onClick={() =>
                      setTools((current) =>
                        current.includes(tool)
                          ? current.filter((item) => item !== tool)
                          : [...current, tool],
                      )
                    }
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
            <button type="button" className="btn-secondary mt-4" onClick={savePrefs}>
              {t("profileSave")}
            </button>
          </section>

          <section className="mt-6">
            <h2 className="text-lg font-black">{t("profileHistory")}</h2>
            {history.length === 0 ? (
              <div className="mt-3">
                <EmptyState title={t("profileNoHistoryTitle")} body={t("profileNoHistoryBody")} />
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/recipes/${item.recipe_id}`}
                      className="card-casual flex items-center justify-between px-4 py-3 text-sm"
                    >
                      <span>{item.recipe_name}</span>
                      <span className="text-muted">
                        {item.completed ? t("profileDone") : t("profileStopped")} ·{" "}
                        {new Date(item.cooked_at).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <button type="button" className="btn-secondary mt-8 w-full" onClick={() => void signOut()}>
        {t("profileLogout")}
      </button>
      {resetOpen ? (
        <ConfirmDialog
          title={t("profileResetConfirm")}
          confirmLabel={resetting ? t("profileResetting") : t("profileResetProgress")}
          busy={resetting}
          onConfirm={() => void resetProgress()}
          onClose={() => {
            if (!resetting) setResetOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}
