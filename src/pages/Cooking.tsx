import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ErrorState } from "../components/common/Feedback";
import { CookingStep } from "../components/cooking/CookingStep";
import { useAuth } from "../hooks/useAuth";
import { clearCookingSession, loadCookingSession } from "../services/aiService";
import { saveCookingHistory } from "../services/historyService";
import { getRecipeDetail } from "../services/recipeService";
import type { AdjustedRecipe } from "../types/recipe";

export function Cooking() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<AdjustedRecipe | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [techniqueNames, setTechniqueNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const session = loadCookingSession(id);
    if (!session) {
      navigate(`/recipes/${id}`, { replace: true });
      return;
    }
    setRecipe(session.recipe);
    setStartedAt(session.startedAt);

    void getRecipeDetail(id).then((detail) => {
      if (!detail) return;
      const names: Record<string, string> = {};
      for (const technique of detail.techniques) names[technique.id] = technique.name;
      setTechniqueNames(names);
    });
  }, [id, navigate]);

  const step = recipe?.steps[stepIndex];
  const total = recipe?.steps.length ?? 0;
  const usedTechniqueIds = useMemo(() => {
    if (!recipe) return [];
    return [
      ...new Set(
        recipe.steps
          .map((item) => item.technique_id)
          .filter((value): value is string => Boolean(value)),
      ),
    ];
  }, [recipe]);

  async function complete() {
    if (!user || !recipe) return;
    setSaving(true);
    setError("");
    try {
      await saveCookingHistory({
        userId: user.id,
        recipeId: id,
        ingredients: recipe.ingredients,
        adjustedRecipe: recipe,
        completed: true,
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        techniqueIds: usedTechniqueIds,
      });
      clearCookingSession(id);
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "기록 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (!recipe || !step) {
    return (
      <main className="page">
        <ErrorState message="조리 세션을 찾을 수 없습니다." />
      </main>
    );
  }

  const isLast = stepIndex === total - 1;

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col px-4 py-5">
      <div className="flex items-center justify-between">
        <Link to={`/recipes/${id}`} className="text-sm text-muted">
          나가기
        </Link>
        <p className="text-sm font-medium">
          STEP {step.step} / {total}
        </p>
        <span className="w-12" />
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full bg-accent"
          style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
        />
      </div>

      <h1 className="mt-6 text-2xl font-semibold leading-snug">{recipe.title}</h1>
      <div className="mt-4">
        <CookingStep
          step={step}
          recipeTitle={recipe.title}
          techniqueName={step.technique_id ? techniqueNames[step.technique_id] : undefined}
        />
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

      <div className="mt-auto flex gap-3 pt-8">
        <button
          type="button"
          className="btn-secondary flex-1"
          onClick={() => setStepIndex((value) => Math.max(0, value - 1))}
          disabled={stepIndex === 0}
        >
          <ChevronLeft className="mr-1 h-4 w-4" strokeWidth={1.75} />
          이전
        </button>
        {isLast ? (
          <button type="button" className="btn-primary flex-1" onClick={complete} disabled={saving}>
            {saving ? "저장 중" : "조리 완료"}
          </button>
        ) : (
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => setStepIndex((value) => Math.min(total - 1, value + 1))}
          >
            다음
            <ChevronRight className="ml-1 h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </main>
  );
}
