import { requireSupabase } from "../lib/supabase";
import type {
  Technique,
  TechniqueDetail,
  TechniqueProgress,
  TechniqueStep,
} from "../types/technique";

export async function listTechniques(): Promise<Technique[]> {
  const { data, error } = await requireSupabase()
    .from("techniques")
    .select(
      "id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number",
    )
    .order("stage_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Technique[];
}

export async function getTechniqueProgress(userId: string): Promise<TechniqueProgress[]> {
  const { data, error } = await requireSupabase()
    .from("user_technique_progress")
    .select("technique_id, status, cleared_at")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as TechniqueProgress[];
}

export async function getTechniqueDetail(id: string): Promise<TechniqueDetail | null> {
  const supabase = requireSupabase();

  const { data: technique, error } = await supabase
    .from("techniques")
    .select(
      "id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!technique) return null;

  const [{ data: steps }, { data: relations }, { data: recipeLinks }] = await Promise.all([
    supabase
      .from("technique_steps")
      .select("id, technique_id, step_number, title, instruction, media_id, media:media_id(*)")
      .eq("technique_id", id)
      .order("step_number", { ascending: true }),
    supabase
      .from("technique_relations")
      .select("related_technique_id")
      .eq("technique_id", id),
    supabase
      .from("recipe_techniques")
      .select("recipe_id, recipes(id, name, slug)")
      .eq("technique_id", id),
  ]);

  const relatedIds = (relations ?? []).map((row) => row.related_technique_id as string);
  let related: Technique[] = [];
  if (relatedIds.length > 0) {
    const { data: relatedRows } = await supabase
      .from("techniques")
      .select(
        "id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number",
      )
      .in("id", relatedIds);
    related = (relatedRows ?? []) as Technique[];
  }

  const recipes = (recipeLinks ?? [])
    .map((row) => {
      const recipe = row.recipes as { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
      if (Array.isArray(recipe)) return recipe[0];
      return recipe;
    })
    .filter((item): item is { id: string; name: string; slug: string } => Boolean(item));

  return {
    ...(technique as Technique),
    steps: ((steps ?? []) as Array<TechniqueStep & { media: TechniqueStep["media"] | TechniqueStep["media"][] }>).map(
      (step) => ({
        ...step,
        media: Array.isArray(step.media) ? (step.media[0] ?? null) : (step.media ?? null),
      }),
    ),
    related,
    recipes,
  };
}

export async function markCleared(userId: string, techniqueId: string): Promise<void> {
  const supabase = requireSupabase();
  const clearedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_technique_progress")
    .update({
      status: "cleared",
      cleared_at: clearedAt,
    })
    .eq("user_id", userId)
    .eq("technique_id", techniqueId)
    .select("technique_id");

  if (error) throw error;
  if (data && data.length > 0) return;

  const { error: upsertError } = await supabase.from("user_technique_progress").upsert(
    {
      user_id: userId,
      technique_id: techniqueId,
      status: "cleared",
      cleared_at: clearedAt,
    },
    { onConflict: "user_id,technique_id" },
  );

  if (upsertError) throw upsertError;
}
