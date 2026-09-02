import { requireSupabase } from "../lib/supabase";
import type { ExperienceLevel, Profile } from "../types/user";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select("id, display_name, experience_level, available_tools, preferred_max_minutes")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, "display_name" | "experience_level" | "available_tools" | "preferred_max_minutes">>,
): Promise<Profile> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, display_name, experience_level, available_tools, preferred_max_minutes")
    .single();

  if (error) throw error;
  return data as Profile;
}

export function experienceFromHistoryCount(count: number): ExperienceLevel {
  if (count >= 8) return "advanced";
  if (count >= 3) return "intermediate";
  return "beginner";
}
