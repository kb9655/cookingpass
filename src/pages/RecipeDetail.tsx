import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { ErrorState, PageLoader, Skeleton } from "../components/common/Feedback";
import { StarRating } from "../components/common/StarRating";
import { LessonProgress } from "../components/technique/LessonProgress";
import {
  IngredientCheckList,
  type IngredientCheck,
} from "../components/recipe/IngredientCheckList";
import { getRecipeDetail } from "../services/recipeService";
import { listUserIngredients } from "../services/ingredientService";
import { requestAdjustedRecipe } from "../services/aiService";
import { listNotePresets, upsertNotePreset } from "../services/notePresetService";
import { updateProfile } from "../services/profileService";
import { formatAmount, scaleAmount } from "../lib/formatAmount";
import { ApiError, suggestSubstitutes } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useLocale } from "../i18n/locale";
import type { MessageKey } from "../i18n/messages";
import type { AdjustedRecipe, RecipeDetail as RecipeDetailType } from "../types/recipe";
import type { RecipeIngredient, UserIngredient } from "../types/ingredient";

type Shortage = {
  name: string;
  need: number;
  have: number;
  unit: string;
};

type WizardStep = "servings" | "ingredients" | "substitutes" | "tools" | "notes" | "review";

type SubstituteChoice = {
  original: string;
  options: string[];
  chosen: string | null;
};

const BUILTIN_NOTE_KEYS = [
  "recipeNoteChip1",
  "recipeNoteChip2",
  "recipeNoteChip3",
  "recipeNoteChip4",
  "recipeNoteChip5",
] as const;

function findShortages(
  ingredients: RecipeIngredient[],
  checks: IngredientCheck[],
  servings: number,
  baseServings: number,
): Shortage[] {
  return checks.flatMap((item) => {
    if (!item.selected) return [];
    const recipeItem = ingredients.find((row) => row.ingredient_id === item.ingredient_id);
    if (!recipeItem) return [];
    const unit = (recipeItem.unit || item.unit || "").toLowerCase();
    if (unit === "to taste") return [];
    const need = scaleAmount(recipeItem.amount ?? 0, servings, baseServings);
    if (need <= 0) return [];
    if (item.amount + 1e-6 >= need) return [];
    return [{ name: item.name, need, have: item.amount, unit: item.unit }];
  });
}

function togglePhrase(text: string, label: string): string {
  if (text.includes(label)) {
    return text
      .replace(label, "")
      .replace(/,\s*,/g, ",")
      .replace(/^[\s,]+|[\s,]+$/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }
  return text.trim() ? `${text.trim()}, ${label}` : label;
}

function wizardSteps(hasMissing: boolean): WizardStep[] {
  return hasMissing
    ? ["servings", "ingredients", "substitutes", "tools", "notes", "review"]
    : ["servings", "ingredients", "tools", "notes", "review"];
}

export function RecipeDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { locale, t } = useLocale();
  const [recipe, setRecipe] = useState<RecipeDetailType | null>(null);
  const [pantry, setPantry] = useState<UserIngredient[]>([]);
  const [checks, setChecks] = useState<IngredientCheck[]>([]);
  const [servings, setServings] = useState(2);
  const [notes, setNotes] = useState("");
  const [presets, setPresets] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [choices, setChoices] = useState<SubstituteChoice[]>([]);
  const [step, setStep] = useState<WizardStep>("servings");
  const [adjusted, setAdjusted] = useState<AdjustedRecipe | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [shortageOpen, setShortageOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const toolsInitFor = useRef("");

  useEffect(() => {
    setStep("servings");
    setNotes("");
    setAdjusted(null);
    setChoices([]);
    setError("");
    toolsInitFor.current = "";
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([getRecipeDetail(id, locale), listUserIngredients("ko")])
      .then(([next, nextPantry]) => {
        if (!active) return;
        setRecipe(next);
        setPantry(nextPantry);
        if (next) setServings(next.servings);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : t("recipesLoadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, locale, t]);

  useEffect(() => {
    if (!recipe || toolsInitFor.current === recipe.id) return;
    if (user && !profile) return;
    const owned = profile?.available_tools ?? [];
    setSelectedTools(
      recipe.required_tools.filter((tool) => owned.length === 0 || owned.includes(tool)),
    );
    toolsInitFor.current = recipe.id;
  }, [recipe, user, profile]);

  useEffect(() => {
    if (!user) {
      setPresets([]);
      return;
    }
    let active = true;
    listNotePresets(user.id)
      .then((next) => {
        if (active) setPresets(next);
      })
      .catch(() => {
        if (active) setPresets([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const missingChecks = useMemo(() => checks.filter((item) => !item.selected), [checks]);
  const hasMissing = missingChecks.length > 0;
  const steps = wizardSteps(hasMissing);
  const stepIndex = Math.max(0, steps.indexOf(step));
  const builtinNotes = BUILTIN_NOTE_KEYS.map((key) => t(key));
  const extraNotes = presets.filter((label) => !builtinNotes.includes(label));

  function pantryPayload() {
    return checks
      .filter((item) => item.selected)
      .map((item) => ({ name: item.name, amount: item.amount, unit: item.unit }));
  }

  async function loadSubstitutes(missing: IngredientCheck[]) {
    if (!recipe) return;
    setSuggesting(true);
    setError("");
    setChoices(missing.map((item) => ({ original: item.name, options: [], chosen: null })));
    try {
      const suggestions = await suggestSubstitutes({
        recipeName: recipe.name,
        locale,
        missing: missing.map((item) => ({ name: item.name, amount: item.amount, unit: item.unit })),
        pantry: pantryPayload(),
      });
      const byName = new Map(suggestions.map((item) => [item.original, item.options]));
      setChoices(
        missing.map((item) => ({
          original: item.name,
          options: byName.get(item.name) ?? [],
          chosen: null,
        })),
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("recipeSubstituteFailed");
      setError(message);
    } finally {
      setSuggesting(false);
    }
  }

  async function persistOwnedTools() {
    if (!recipe) return;
    try {
      if (user) {
        const recipeSet = new Set(recipe.required_tools);
        const kept = (profile?.available_tools ?? []).filter((tool) => !recipeSet.has(tool));
        const next = [...new Set([...kept, ...selectedTools])];
        await updateProfile(user.id, { available_tools: next });
        await refreshProfile();
      }
      setStep("notes");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profileSaveError"));
    }
  }

  async function runAdjust() {
    if (!recipe) return;
    setAdjusting(true);
    setError("");
    setAdjusted(null);
    try {
      const next = await requestAdjustedRecipe({
        recipeId: recipe.id,
        servings,
        notes,
        locale,
        substitutions: choices
          .filter((item) => item.chosen)
          .map((item) => ({ original: item.original, replacement: item.chosen as string })),
        missing_tools: recipe.required_tools.filter((tool) => !selectedTools.includes(tool)),
        recipe: {
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          servings: recipe.servings,
          required_tools: recipe.required_tools,
          ingredients: recipe.ingredients.map((item) => ({
            name: item.name,
            amount: item.amount,
            unit: item.unit,
            notes: item.notes,
          })),
          steps: recipe.steps.map((item) => ({
            step_number: item.step_number,
            instruction: item.instruction,
            technique_id: item.technique_id,
          })),
          techniques: recipe.techniques.map((technique) => ({
            id: technique.id,
            name: technique.name,
          })),
        },
        pantry: pantryPayload(),
      });
      setAdjusted(next);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("recipeAdjustFailed");
      setError(message);
    } finally {
      setAdjusting(false);
    }
  }

  function goToReview() {
    setSaveOpen(false);
    setStep("review");
    void runAdjust();
  }

  function advanceFromIngredients() {
    if (missingChecks.length > 0) {
      setSuggesting(true);
      setStep("substitutes");
      void loadSubstitutes(missingChecks);
      return;
    }
    setStep("tools");
  }

  function goNext() {
    if (!recipe) return;
    setError("");
    if (step === "servings") {
      setStep("ingredients");
      return;
    }
    if (step === "ingredients") {
      const missing = findShortages(recipe.ingredients, checks, servings, recipe.servings);
      if (missing.length > 0) {
        setShortages(missing);
        setShortageOpen(true);
        return;
      }
      advanceFromIngredients();
      return;
    }
    if (step === "substitutes") {
      setStep("tools");
      return;
    }
    if (step === "tools") {
      void persistOwnedTools();
      return;
    }
    if (step === "notes") {
      if (user && notes.trim()) {
        setSaveOpen(true);
        return;
      }
      goToReview();
    }
  }

  function goBack() {
    setError("");
    if (step === "ingredients") setStep("servings");
    else if (step === "substitutes") setStep("ingredients");
    else if (step === "tools") setStep(hasMissing ? "substitutes" : "ingredients");
    else if (step === "notes") setStep("tools");
    else if (step === "review") setStep("notes");
  }

  async function saveNoteAndContinue() {
    if (!user) {
      goToReview();
      return;
    }
    setSavingNote(true);
    setError("");
    try {
      await upsertNotePreset(user.id, notes);
      const next = await listNotePresets(user.id);
      setPresets(next);
      goToReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profileSaveError"));
    } finally {
      setSavingNote(false);
    }
  }

  function startCooking() {
    if (!recipe || !adjusted) return;
    if (user) {
      navigate(`/cook/${recipe.id}`);
    } else {
      navigate("/login", { state: { from: `/cook/${recipe.id}` } });
    }
  }

  const stepTitleKey: Record<WizardStep, MessageKey> = {
    servings: "recipeWizardServingsTitle",
    ingredients: "recipeWizardIngredientsTitle",
    substitutes: "recipeWizardSubstitutesTitle",
    tools: "recipeWizardToolsTitle",
    notes: "recipeWizardNotesTitle",
    review: "recipeWizardReviewTitle",
  };

  if (loading) {
    return (
      <main className="page space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  if (!recipe) {
    return (
      <main className="page">
        <ErrorState message={error || t("recipeNotFound")} />
      </main>
    );
  }

  const primaryLabel =
    step === "notes"
      ? t("recipeAdjustSubmit")
      : step === "review"
        ? adjusting
          ? t("recipeAdjustingBtn")
          : adjusted
            ? t("recipeStartCooking")
            : t("recipeReviewRetry")
        : t("recipeWizardNext");

  return (
    <main className="page pb-8">
      <p className="text-xs text-muted">
        {recipe.category}
        {recipe.subcategory ? ` · ${recipe.subcategory}` : ""}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight break-keep">{recipe.name}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <StarRating value={recipe.difficulty} />
        <span>{t("recipeMinutes", { n: recipe.estimated_minutes })}</span>
        <span>{t("recipeBaseServings", { n: recipe.servings })}</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{recipe.description}</p>

      <div className="mt-6">
        <LessonProgress total={steps.length} current={stepIndex} />
      </div>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">{t(stepTitleKey[step])}</h2>

        {step === "servings" ? (
          <>
            <div className="field mt-3 max-w-[10rem]">
              <label htmlFor="servings">{t("recipeServingsLabel")}</label>
              <input
                id="servings"
                type="number"
                min={1}
                max={Math.max(12, recipe.servings)}
                value={servings}
                onChange={(event) => setServings(Number(event.target.value))}
              />
            </div>
            <h3 className="mt-8 text-base font-semibold">{t("recipeSteps")}</h3>
            <ol className="mt-3 space-y-3 text-sm text-muted">
              {recipe.steps.map((item) => (
                <li key={item.id}>
                  <span className="font-medium text-ink">{item.step_number}. </span>
                  {item.instruction}
                </li>
              ))}
            </ol>
            <h3 className="mt-8 text-base font-semibold">{t("recipeTechniques")}</h3>
            {recipe.techniques.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("recipeNoTechniques")}</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {recipe.techniques.map((technique) => (
                  <Link
                    key={technique.id}
                    to={`/techniques/${technique.id}`}
                    className="rounded-full border border-line bg-card px-3 py-1 text-sm"
                  >
                    {technique.name}
                  </Link>
                ))}
              </div>
            )}
          </>
        ) : null}

        <div className={step === "ingredients" ? "mt-3" : "hidden"}>
          <IngredientCheckList
            ingredients={recipe.ingredients}
            pantry={pantry}
            servings={servings}
            baseServings={recipe.servings}
            onChange={setChecks}
          />
        </div>

        {step === "substitutes" ? (
          <div className="mt-3">
            <p className="text-sm text-muted">{t("recipeWizardSubstitutesLead")}</p>
            {suggesting ? (
              <PageLoader label={t("recipeSubstituteLoading")} />
            ) : (
              <ul className="mt-4 space-y-5">
                {choices.map((item) => (
                  <li key={item.original}>
                    <p className="text-sm font-medium">{item.original}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.options.map((option) => {
                        const selected = item.chosen === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={`min-h-11 rounded-full border px-3 py-1 text-sm ${
                              selected
                                ? "border-accent bg-accent text-white"
                                : "border-line bg-white text-ink"
                            }`}
                            aria-pressed={selected}
                            onClick={() =>
                              setChoices((current) =>
                                current.map((row) =>
                                  row.original === item.original
                                    ? { ...row, chosen: selected ? null : option }
                                    : row,
                                ),
                              )
                            }
                          >
                            {option}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={`min-h-11 rounded-full border px-3 py-1 text-sm ${
                          item.chosen === null
                            ? "border-accent bg-accent text-white"
                            : "border-line bg-white text-ink"
                        }`}
                        aria-pressed={item.chosen === null}
                        onClick={() =>
                          setChoices((current) =>
                            current.map((row) =>
                              row.original === item.original ? { ...row, chosen: null } : row,
                            ),
                          )
                        }
                      >
                        {t("recipeSubstituteSkip")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {step === "tools" ? (
          <div className="mt-3">
            {recipe.required_tools.length === 0 ? (
              <p className="text-sm text-muted">{t("recipeNoTools")}</p>
            ) : (
              <>
                <p className="text-sm text-muted">{t("recipeWizardToolsHint")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recipe.required_tools.map((tool) => {
                    const active = selectedTools.includes(tool);
                    return (
                      <button
                        key={tool}
                        type="button"
                        className={`rounded-full px-3 py-2 text-sm ${
                          active ? "bg-accent text-white" : "border border-line bg-card text-muted"
                        }`}
                        aria-pressed={active}
                        onClick={() =>
                          setSelectedTools((current) =>
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
              </>
            )}
          </div>
        ) : null}

        {step === "notes" ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-muted">
              {t("recipePantryCount", { n: checks.filter((item) => item.selected).length })}
            </p>
            <div className="field">
              <label htmlFor="notes">{t("recipeNotes")}</label>
              <p className="mb-2 text-xs text-muted">{t("recipeNoteChips")}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {[...builtinNotes, ...extraNotes].map((label) => {
                  const selected = notes.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`min-h-11 rounded-full border px-3 py-1 text-sm ${
                        selected ? "border-accent bg-accent text-white" : "border-line bg-white text-ink"
                      }`}
                      aria-pressed={selected}
                      onClick={() => setNotes((current) => togglePhrase(current, label))}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <textarea
                id="notes"
                rows={3}
                placeholder={t("recipeNotesPlaceholder")}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === "review" ? (
          <div className="mt-3">
            {adjusting ? (
              <PageLoader label={t("recipeAdjusting")} />
            ) : adjusted ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-muted">{t("recipeClaudeResult")}</p>
                  <p className="mt-1 text-xl font-semibold break-keep">{adjusted.title}</p>
                  <p className="mt-1 text-sm text-muted">{t("recipeServings", { n: adjusted.servings })}</p>
                  {adjusted.notes ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted">{adjusted.notes}</p>
                  ) : null}
                </div>
                {adjusted.missing_or_substitutions?.length ? (
                  <div>
                    <h3 className="text-base font-semibold">{t("recipeSubs")}</h3>
                    <ul className="mt-2 space-y-1 text-sm text-muted">
                      {adjusted.missing_or_substitutions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div>
                  <h3 className="text-base font-semibold">{t("recipeAdjustedIngredients")}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {adjusted.ingredients.map((item) => (
                      <li key={`${item.name}-${item.substituted_for ?? ""}`}>
                        {item.name} · {formatAmount(item.amount)} {item.unit}
                        {item.substituted_for
                          ? ` (${t("recipeSubstitute")}: ${item.substituted_for})`
                          : null}
                        {item.note ? ` · ${item.note}` : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-base font-semibold">{t("recipeAdjustedSteps")}</h3>
                  <ol className="mt-2 space-y-2 text-sm text-muted">
                    {adjusted.steps.map((item) => (
                      <li key={item.step}>
                        <span className="font-medium text-ink">{item.step}. </span>
                        {item.instruction}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : error ? (
              <ErrorState message={error} onRetry={() => void runAdjust()} />
            ) : null}
          </div>
        ) : null}
      </section>

      {error && step !== "review" ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-8 flex flex-col gap-2">
        <button
          className="btn-primary w-full"
          type="button"
          disabled={
            (step === "substitutes" && suggesting) ||
            (step === "review" && (adjusting || (!adjusted && !error)))
          }
          onClick={() => {
            if (step === "review") {
              if (adjusted) startCooking();
              else void runAdjust();
              return;
            }
            goNext();
          }}
        >
          {primaryLabel}
        </button>
        {step !== "servings" ? (
          <button className="btn-secondary w-full" type="button" disabled={adjusting} onClick={goBack}>
            {t("recipeWizardBack")}
          </button>
        ) : null}
      </div>

      {shortageOpen ? (
        <ConfirmDialog
          title={t("recipeShortageTitle")}
          confirmLabel={t("recipeShortageContinue")}
          cancelLabel={t("recipeShortageCancel")}
          onConfirm={() => {
            setShortageOpen(false);
            advanceFromIngredients();
          }}
          onClose={() => setShortageOpen(false)}
        >
          <p>{t("recipeShortageLead")}</p>
          <ul className="mt-3 space-y-1">
            {shortages.map((item) => (
              <li key={item.name}>
                {t("recipeShortageItem", {
                  name: item.name,
                  need: formatAmount(item.need),
                  have: formatAmount(item.have),
                  unit: item.unit,
                })}
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      ) : null}

      {saveOpen ? (
        <ConfirmDialog
          title={t("recipeWizardSaveNoteTitle")}
          confirmLabel={savingNote ? t("profileSave") : t("recipeWizardSaveYes")}
          cancelLabel={t("recipeWizardSaveNo")}
          busy={savingNote}
          onConfirm={() => void saveNoteAndContinue()}
          onClose={() => {
            if (savingNote) return;
            goToReview();
          }}
        >
          <p>{t("recipeWizardSaveNoteLead")}</p>
        </ConfirmDialog>
      ) : null}
    </main>
  );
}
