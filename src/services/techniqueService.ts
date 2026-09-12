import { requireSupabase } from "../lib/supabase";
import type {
  Technique,
  TechniqueCriterion,
  TechniqueDetail,
  TechniqueProgress,
  TechniqueStep,
} from "../types/technique";

const TECHNIQUE_COLUMNS =
  "id, slug, name, description, difficulty, estimated_minutes, learning_goals, required_tools, precautions, stage_number, parent_id, target_size, capture_hint";

export async function listTechniques(): Promise<Technique[]> {
  const { data, error } = await requireSupabase()
    .from("techniques")
    .select(TECHNIQUE_COLUMNS)
    .is("parent_id", null)
    .order("stage_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Technique[];
}

export async function listChildTechniques(parentId: string): Promise<Technique[]> {
  const { data, error } = await requireSupabase()
    .from("techniques")
    .select(TECHNIQUE_COLUMNS)
    .eq("parent_id", parentId)
    .order("stage_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Technique[];
}

export async function listChildTechniquesByParents(parentIds: string[]): Promise<Technique[]> {
  if (parentIds.length === 0) return [];
  const { data, error } = await requireSupabase()
    .from("techniques")
    .select(TECHNIQUE_COLUMNS)
    .in("parent_id", parentIds)
    .order("stage_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Technique[];
}

export async function getTechniqueProgress(userId: string): Promise<TechniqueProgress[]> {
  const { data, error } = await requireSupabase()
    .from("user_technique_progress")
    .select("technique_id, status, cleared_at, last_item_scores")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []) as TechniqueProgress[];
}

export async function getTechniqueDetail(id: string): Promise<TechniqueDetail | null> {
  const supabase = requireSupabase();

  const { data: technique, error } = await supabase
    .from("techniques")
    .select(TECHNIQUE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!technique) return null;

  const [{ data: steps }, { data: relations }, { data: criteria }, children] = await Promise.all([
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
        .from("technique_criteria")
        .select("id, technique_id, sort_order, name, check_hint, is_safety")
        .eq("technique_id", id)
        .order("sort_order", { ascending: true }),
      listChildTechniques(id),
    ]);

  const relatedIds = (relations ?? []).map((row) => row.related_technique_id as string);
  let related: Technique[] = [];
  if (relatedIds.length > 0) {
    const { data: relatedRows } = await supabase
      .from("techniques")
      .select(TECHNIQUE_COLUMNS)
      .in("id", relatedIds);
    related = (relatedRows ?? []) as Technique[];
  }

  return {
    ...(technique as Technique),
    steps: ((steps ?? []) as Array<TechniqueStep & { media: TechniqueStep["media"] | TechniqueStep["media"][] }>).map(
      (step) => ({
        ...step,
        media: Array.isArray(step.media) ? (step.media[0] ?? null) : (step.media ?? null),
      }),
    ),
    related,
    criteria: (criteria ?? []) as TechniqueCriterion[],
    children,
  };
}

export async function saveTechniqueScores(
  userId: string,
  techniqueId: string,
  scores: number[],
  passed: boolean,
  parentId?: string | null,
): Promise<void> {
  const supabase = requireSupabase();
  const clearedAt = passed ? new Date().toISOString() : null;

  async function upsert(targetId: string) {
    const payload = {
      user_id: userId,
      technique_id: targetId,
      status: passed ? "cleared" : "unlocked",
      cleared_at: clearedAt,
      last_item_scores: scores,
    };
    const { data, error } = await supabase
      .from("user_technique_progress")
      .update({
        status: payload.status,
        cleared_at: payload.cleared_at,
        last_item_scores: payload.last_item_scores,
      })
      .eq("user_id", userId)
      .eq("technique_id", targetId)
      .select("technique_id");
    if (error) throw error;
    if (data && data.length > 0) return;

    const { error: upsertError } = await supabase
      .from("user_technique_progress")
      .upsert(payload, { onConflict: "user_id,technique_id" });
    if (upsertError) throw upsertError;
  }

  await upsert(techniqueId);
  if (parentId) await upsert(parentId);
}

export function scoresForTechnique(
  techniqueId: string,
  childIds: string[],
  progress: TechniqueProgress[],
): number[] | null {
  const own = progress.find((item) => item.technique_id === techniqueId)?.last_item_scores;
  if (own && own.length === 3) return own;
  for (const childId of childIds) {
    const child = progress.find((item) => item.technique_id === childId)?.last_item_scores;
    if (child && child.length === 3) return child;
  }
  return null;
}
