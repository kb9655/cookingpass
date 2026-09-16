import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { getTechniqueProgress, listTechniques, resetAllTechniqueProgress } from "../services/techniqueService";
import { listCookingHistory, sumCompletedCookingStars } from "../services/historyService";
import { importSharedRecipe, listUserRecipes } from "../services/userRecipeService";
import { updateProfile } from "../services/profileService";
import { listKnownTools } from "../services/recipeService";
import { LanguageToggle } from "../components/common/LanguageToggle";
import { MeasureToggle } from "../components/common/MeasureToggle";
import { ProgressBar } from "../components/common/ProgressBar";
import { EmptyState, ErrorState, PageLoader } from "../components/common/Feedback";
import { RecentRecipeList } from "../components/recipe/RecentRecipeList";
import { useLocale } from "../i18n/locale";
import { playerLevelFromClears } from "../lib/playerLevel";
import { DEFAULT_TOOLS, mergeToolOptions } from "../lib/tools";
import type { Technique, TechniqueProgress } from "../types/technique";
import type { CookingHistory, ExperienceLevel } from "../types/user";
import type { SavedUserRecipe } from "../types/recipe";

function importMessage(err: unknown, fallback: string, own: string): string {
  const message = err instanceof Error ? err.message : "";
  if (message.includes("own recipe")) return own;
  if (
    message.includes("Invalid") ||
    message.includes("not found") ||
    message.includes("InvalidShareCode")
  ) {
    return fallback;
  }
  return message || fallback;
}

export function Profile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { locale, t } = useLocale();
  const navigate = useNavigate();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [progress, setProgress] = useState<TechniqueProgress[]>([]);
  const [history, setHistory] = useState<CookingHistory[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedUserRecipe[]>([]);
  const [cookingStars, setCookingStars] = useState(0);
  const [importCode, setImportCode] = useState("");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [experience, setExperience] = useState<ExperienceLevel>(profile?.experience_level ?? "beginner");
  const [tools, setTools] = useState<string[]>(profile?.available_tools ?? []);
  const [knownTools, setKnownTools] = useState<string[]>(DEFAULT_TOOLS);

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
      listUserRecipes(user.id).catch(() => []),
      listKnownTools().catch(() => DEFAULT_TOOLS),
      sumCompletedCookingStars(user.id).catch(() => 0),
    ])
      .then(([nextTechniques, nextProgress, nextHistory, nextSaved, nextTools, nextStars]) => {
        if (!active) return;
        setTechniques(nextTechniques);
        setProgress(nextProgress);
        setHistory(nextHistory);
        setSavedRecipes(nextSaved);
        setKnownTools(nextTools);
        setCookingStars(nextStars);
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
  const player = playerLevelFromClears(cleared, cookingStars);
  const toolOptions = mergeToolOptions(DEFAULT_TOOLS, knownTools, tools);

  async function onImport(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError("");
    setImporting(true);
    try {
      const id = await importSharedRecipe(importCode);
      setImportCode("");
      navigate(`/saved/${id}`);
    } catch (err) {
      setError(importMessage(err, t("savedRecipeImportError"), t("savedRecipeImportOwn")));
    } finally {
      setImporting(false);
    }
  }

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
            {import.meta.env.DEV ? (
              <button
                type="button"
                className="btn-secondary mt-4 w-full"
                onClick={() => setResetOpen(true)}
              >
                {t("profileResetProgress")}
              </button>
            ) : null}
            <ul className="mt-4 space-y-2 text-sm">
              {techniques.map((technique) => {
                const status =
                  progress.find((item) => item.technique_id === technique.id)?.status ?? "unlocked";
                const cleared = status === "cleared";
                return (
                  <li key={technique.id} className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 break-keep">{technique.name}</span>
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
            <MeasureToggle className="mt-4" />
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
              {toolOptions.map((tool) => {
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
            <h2 className="text-lg font-black">{t("profileSavedRecipes")}</h2>
            <form className="mt-3 flex min-w-0 gap-2" onSubmit={(event) => void onImport(event)}>
              <div className="field min-w-0 flex-1">
                <label htmlFor="share-code" className="sr-only">
                  {t("profileImportCode")}
                </label>
                <input
                  id="share-code"
                  value={importCode}
                  onChange={(event) => setImportCode(event.target.value)}
                  placeholder={t("profileImportPlaceholder")}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <button className="btn-secondary min-h-12 shrink-0 self-end" type="submit" disabled={importing || !importCode.trim()}>
                {importing ? t("profileImporting") : t("profileImport")}
              </button>
            </form>
            {savedRecipes.length === 0 ? (
              <div className="mt-3">
                <EmptyState title={t("profileNoSavedTitle")} body={t("profileNoSavedBody")} />
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {savedRecipes.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/saved/${item.id}`}
                      className="card-casual flex min-w-0 items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <span className="min-w-0 flex-1 break-keep">{item.title}</span>
                      <span className="shrink-0 text-right text-muted">
                        {item.shareCode ? `${t("profileShared")} · ` : ""}
                        {new Date(item.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "ko-KR")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <RecentRecipeList title={t("profileRecent")} />

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
                      className="card-casual flex min-w-0 items-start justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <span className="min-w-0 flex-1 break-keep">{item.recipe_name}</span>
                      <span className="shrink-0 text-right text-muted">
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
      {resetOpen && import.meta.env.DEV ? (
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
