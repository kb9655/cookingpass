import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, CardSkeleton } from "../components/common/Feedback";
import { useAuth } from "../hooks/useAuth";
import {
  deleteUserIngredient,
  listCatalogIngredients,
  listUserIngredients,
  updateUserIngredient,
  upsertUserIngredient,
} from "../services/ingredientService";
import type { Ingredient, UserIngredient } from "../types/ingredient";

export function Ingredients() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [items, setItems] = useState<UserIngredient[]>([]);
  const [query, setQuery] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState("개");
  const [expiresAt, setExpiresAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const selected = catalog.find((item) => item.id === ingredientId);

  const filteredCatalog = useMemo(() => {
    const q = query.trim();
    if (!q) return catalog.slice(0, 12);
    return catalog.filter((item) => item.name.includes(q)).slice(0, 12);
  }, [catalog, query]);

  async function load() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [nextCatalog, nextItems] = await Promise.all([
        listCatalogIngredients(),
        listUserIngredients(user.id),
      ]);
      setCatalog(nextCatalog);
      setItems(nextItems);
      if (!ingredientId && nextCatalog[0]) {
        setIngredientId(nextCatalog[0].id);
        setUnit(nextCatalog[0].default_unit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "재료를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !ingredientId) return;
    setError("");
    try {
      if (editingId) {
        await updateUserIngredient(editingId, {
          amount: Number(amount),
          unit,
          expires_at: expiresAt || null,
        });
      } else {
        await upsertUserIngredient({
          userId: user.id,
          ingredientId,
          amount: Number(amount),
          unit,
          expiresAt: expiresAt || null,
        });
      }
      setEditingId(null);
      setAmount("1");
      setExpiresAt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "재료 저장에 실패했습니다.");
    }
  }

  function startEdit(item: UserIngredient) {
    setEditingId(item.id);
    setIngredientId(item.ingredient_id);
    setAmount(String(item.amount));
    setUnit(item.unit);
    setExpiresAt(item.expires_at ?? "");
    setQuery(item.name);
  }

  async function remove(id: string) {
    setError("");
    try {
      await deleteUserIngredient(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  }

  return (
    <main className="page pb-8">
      <h1 className="text-3xl font-semibold tracking-tight">보유 재료</h1>
      <p className="mt-2 text-sm text-muted">지금 있는 재료와 용량을 적어 두면 레시피 조정에 쓰입니다.</p>

      <form className="mt-6 space-y-3 rounded-[1.5rem] border border-line bg-card p-4" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="query">재료 검색</label>
          <input
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="감자, 양파..."
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filteredCatalog.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-full px-3 py-1 text-sm ${
                ingredientId === item.id ? "bg-accent text-white" : "border border-line bg-card"
              }`}
              onClick={() => {
                setIngredientId(item.id);
                setUnit(item.default_unit);
                setQuery(item.name);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label htmlFor="amount">보유량</label>
            <input
              id="amount"
              type="number"
              min={0}
              step="0.1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="unit">단위</label>
            <input id="unit" value={unit} onChange={(event) => setUnit(event.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="expires">유통기한 (선택)</label>
          <input
            id="expires"
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>
        <button className="btn-primary w-full" type="submit">
          {editingId ? "수정 저장" : `${selected?.name ?? "재료"} 추가`}
        </button>
      </form>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : null}

      <section className="mt-6 grid gap-3">
        {loading ? (
          Array.from({ length: 3 }, (_, index) => <CardSkeleton key={index} />)
        ) : items.length === 0 ? (
          <EmptyState title="아직 재료가 없습니다" body="자주 쓰는 재료부터 등록해 보세요." />
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[1.5rem] border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {item.amount}
                    {item.unit}
                    {item.expires_at ? ` · ${item.expires_at}까지` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary !min-h-9 !px-3 text-xs" onClick={() => startEdit(item)}>
                    수정
                  </button>
                  <button type="button" className="btn-secondary !min-h-9 !px-3 text-xs" onClick={() => remove(item.id)}>
                    삭제
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
