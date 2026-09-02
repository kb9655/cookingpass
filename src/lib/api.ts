import type { AdjustedRecipe } from "../types/recipe";
import { requireSupabase } from "./supabase";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const supabase = requireSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError("로그인이 필요합니다.", 401);
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function generateRecipe(input: {
  recipeId: string;
  servings: number;
  notes?: string;
}): Promise<AdjustedRecipe> {
  const response = await fetch("/api/generate-recipe", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      recipe_id: input.recipeId,
      servings: input.servings,
      notes: input.notes ?? "",
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; recipe?: AdjustedRecipe }
    | AdjustedRecipe
    | null;

  if (!response.ok) {
    const message =
      payload && "error" in payload && payload.error
        ? payload.error
        : "레시피 조정 요청에 실패했습니다.";
    throw new ApiError(message, response.status);
  }

  if (payload && "recipe" in payload && payload.recipe) {
    return payload.recipe;
  }

  if (payload && "title" in payload && "steps" in payload) {
    return payload;
  }

  throw new ApiError("서버가 예상과 다른 응답을 반환했습니다.", 502);
}

export async function resolveMediaUrl(input: {
  mediaId?: string;
  storagePath?: string | null;
  sourceUrl?: string | null;
}): Promise<string | null> {
  if (input.sourceUrl) return input.sourceUrl;
  if (!input.mediaId && !input.storagePath) return null;

  try {
    const headers = await authHeaders().catch(() => ({
      "Content-Type": "application/json",
    }));
    const response = await fetch("/api/media-url", {
      method: "POST",
      headers,
      body: JSON.stringify({
        media_id: input.mediaId,
        storage_path: input.storagePath,
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { url?: string | null };
    return payload.url ?? null;
  } catch {
    return null;
  }
}
