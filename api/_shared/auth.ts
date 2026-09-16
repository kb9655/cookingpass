import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { env } from "./env";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

export function getSupabaseForUser(request: Request): SupabaseClient | null {
  const url = env("SUPABASE_URL") ?? env("VITE_SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY") ?? env("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;

  const authorization = request.headers.get("Authorization") ?? "";
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireUser(request: Request): Promise<
  { supabase: SupabaseClient; user: User } | { error: Response }
> {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return { error: errorResponse("로그인이 필요합니다.", 401) };
  }

  const supabase = getSupabaseForUser(request);
  if (!supabase) {
    return { error: errorResponse("Supabase가 설정되지 않았습니다.", 500) };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: errorResponse("로그인이 필요합니다.", 401) };
  }

  return { supabase, user };
}
