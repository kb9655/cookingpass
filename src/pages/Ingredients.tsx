import { FormEvent, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, CardSkeleton } from "../components/common/Feedback";
import {
  deleteUserIngredient,
  listCatalogIngredients,
  listUserIngredients,
  updateUserIngredient,
  upsertUserIngredient,
} from "../services/ingredientService";
import { customIngredient } from "../data/recipeRepository";
import { useLocale } from "../i18n/locale";
import type { Ingredient, UserIngredient } from "../types/ingredient";

export function Ingredients() {
  const { locale, t } = useLocale();
  const [catalog, setCatalog] = useState<Ingredient[]>([]);
  const [items, setItems] = useState<UserIngredient[]>([]);
  const [query, setQuery] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState("count");
  const [expiresAt, setExpiresAt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const selected =
    catalog.find((item) => item.id === ingredientId) ??
    (query.trim() ? customIngredient(query, unit) : undefined);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog.slice(0, 12);
    return catalog.filter((item) => item.name.toLowerCase().includes(q)).slice(0, 12);
  }, [catalog, query]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextCatalog, nextItems] = await Promise.all([
        listCatalogIngredients(locale),
        listUserIngredients(locale),
      ]);
      setCatalog(nextCatalog);
      setItems(nextItems);
      if (!ingredientId && nextCatalog[0]) {
        setIngredientId(nextCatalog[0].id);
        setUnit(nextCatalog[0].default_unit);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ingredientsLoadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const target = selected;
    if (!target) return;
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
          ingredientId: target.id,
          name: target.name,
          amount: Number(amount),
          unit,
          expiresAt: expiresAt || null,
          category: target.category,
          locale,
        });
      }
      setEditingId(null);
      setAmount("1");
      setExpiresAt("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("ingredientsSaveError"));
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
      setError(err instanceof Error ? err.message : t("ingredientsDeleteError"));
    }
  }

  return (
    <main className="page pb-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t("ingredientsTitle")}</h1>
      <p className="mt-2 text-sm text-muted">{t("ingredientsLead")}</p>

      <form className="mt-6 space-y-3 rounded-[1.5rem] border border-line bg-card p-4" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="query">{t("ingredientsSearch")}</label>
          <input
            id="query"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIngredientId("");
            }}
            placeholder={t("ingredientsSearchPlaceholder")}
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
            <label htmlFor="amount">{t("ingredientsAmount")}</label>
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
            <label htmlFor="unit">{t("ingredientsUnit")}</label>
            <input id="unit" value={unit} onChange={(event) => setUnit(event.target.value)} required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="expires">{t("ingredientsExpires")}</label>
          <input
            id="expires"
            type="date"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>
        <button className="btn-primary w-full" type="submit">
          {editingId ? t("ingredientsSave") : `${selected?.name ?? t("navIngredients")} ${t("ingredientsAdd")}`}
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
          <EmptyState title={t("ingredientsEmptyTitle")} body={t("ingredientsEmptyBody")} />
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[1.5rem] border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {item.amount}
                    {item.unit}
                    {item.expires_at ? ` · ${item.expires_at} ${t("ingredientsUntil")}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary !min-h-9 !px-3 text-xs" onClick={() => startEdit(item)}>
                    {t("ingredientsEdit")}
                  </button>
                  <button type="button" className="btn-secondary !min-h-9 !px-3 text-xs" onClick={() => remove(item.id)}>
                    {t("ingredientsDelete")}
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
