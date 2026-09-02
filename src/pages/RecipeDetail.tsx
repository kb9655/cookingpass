import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MediaSlot } from "../components/common/MediaSlot";
import { ErrorState, Skeleton } from "../components/common/Feedback";
import { StarRating } from "../components/common/StarRating";
import { useAuth } from "../hooks/useAuth";
import { isSupabaseConfigured } from "../lib/supabase";
import { getRecipeDetail } from "../services/recipeService";
import { requestAdjustedRecipe } from "../services/aiService";
import { ApiError } from "../lib/api";
import type { RecipeDetail } from "../types/recipe";

export function RecipeDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [servings, setServings] = useState(1);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getRecipeDetail(id)
      .then((next) => {
        if (!active) return;
        setRecipe(next);
        if (next) setServings(next.servings);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "레시피를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  async function onAdjust(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: `/recipes/${id}` } });
      return;
    }
    setAdjusting(true);
    setError("");
    try {
      await requestAdjustedRecipe({ recipeId: id, servings, notes });
      navigate(`/cook/${id}`);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "레시피 조정에 실패했습니다.";
      setError(message);
    } finally {
      setAdjusting(false);
    }
  }

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
        <ErrorState message={error || "레시피를 찾을 수 없습니다."} />
      </main>
    );
  }

  return (
    <main className="page pb-8">
      <h1 className="text-3xl font-semibold tracking-tight">{recipe.name}</h1>
      <div className="mt-3 flex items-center gap-3 text-sm text-muted">
        <StarRating value={recipe.difficulty} />
        <span>약 {recipe.estimated_minutes}분</span>
        <span>{recipe.servings}인분</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">{recipe.description}</p>
      <div className="mt-4">
        <MediaSlot label={recipe.name} />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">재료</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {recipe.ingredients.map((item) => (
            <li key={item.ingredient_id} className="flex justify-between border-b border-line py-2">
              <span>{item.name}</span>
              <span className="text-muted">
                {item.amount}
                {item.unit}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">원본 순서</h2>
        <ol className="mt-3 space-y-3 text-sm text-muted">
          {recipe.steps.map((step) => (
            <li key={step.id}>
              <span className="font-medium text-ink">{step.step_number}. </span>
              {step.instruction}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">필요한 기술</h2>
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
      </section>

      <form className="mt-8 space-y-4 rounded-[1.5rem] border border-line bg-card p-4" onSubmit={onAdjust}>
        <h2 className="text-lg font-semibold">내 재료로 조정</h2>
        <div className="field">
          <label htmlFor="servings">인분</label>
          <input
            id="servings"
            type="number"
            min={1}
            max={8}
            value={servings}
            onChange={(event) => setServings(Number(event.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="notes">선택사항</label>
          <textarea
            id="notes"
            rows={3}
            placeholder="맵기, 기름 적게, 없는 재료 대체 등"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {adjusting ? (
          <p className="text-sm text-muted">보유 재료에 맞춰 조리 순서를 만들고 있습니다.</p>
        ) : null}
        <button className="btn-primary w-full" type="submit" disabled={adjusting}>
          {adjusting ? "조정 중" : "조정하고 조리 시작"}
        </button>
      </form>
    </main>
  );
}
