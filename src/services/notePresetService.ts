import { isSupabaseConfigured, requireSupabase } from "../lib/supabase";

export async function listNotePresets(userId: string): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await requireSupabase()
    .from("recipe_note_presets")
    .select("label")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((row) => row.label?.trim())
    .filter((label): label is string => Boolean(label));
}

export async function upsertNotePreset(userId: string, label: string): Promise<void> {
  const trimmed = label.trim().slice(0, 200);
  if (!trimmed || !isSupabaseConfigured) return;
  const { error } = await requireSupabase()
    .from("recipe_note_presets")
    .upsert({ user_id: userId, label: trimmed }, { onConflict: "user_id,label" });
  if (error) throw error;
}
