import type { AdjustedRecipe } from "../types/recipe";
import { isSupabaseConfigured, requireSupabase } from "./supabase";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type GenerateRecipeInput = {
  recipeId: string;
  servings: number;
  notes?: string;
  recipe: {
    id: string;
    name: string;
    description: string;
    servings: number;
    required_tools: string[];
    ingredients: Array<{ name: string; amount: number; unit: string; notes?: string | null }>;
    steps: Array<{ step_number: number; instruction: string; technique_id?: string | null }>;
    techniques: Array<{ id: string; name: string }>;
  };
  pantry: Array<{ name: string; amount: number; unit: string }>;
};

async function jsonHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isSupabaseConfigured) return headers;

  try {
    const {
      data: { session },
    } = await requireSupabase().auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    // Local recipe flow does not require auth.
  }
  return headers;
}

export async function generateRecipe(input: GenerateRecipeInput): Promise<AdjustedRecipe> {
  const response = await fetch("/api/generate-recipe", {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify({
      recipe_id: input.recipeId,
      servings: input.servings,
      notes: input.notes ?? "",
      recipe: input.recipe,
      pantry: input.pantry,
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
    const response = await fetch("/api/media-url", {
      method: "POST",
      headers: await jsonHeaders(),
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
