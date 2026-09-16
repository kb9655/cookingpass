import { requireSupabase } from "../lib/supabase";
import type { ExperienceLevel, Profile } from "../types/user";

const PROFILE_COLUMNS =
  "id, display_name, experience_level, available_tools, preferred_max_minutes, preferred_locale, preferred_mass, preferred_volume, preferred_length";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as Profile | null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<
    Pick<
      Profile,
      | "display_name"
      | "experience_level"
      | "available_tools"
      | "preferred_max_minutes"
      | "preferred_locale"
      | "preferred_mass"
      | "preferred_volume"
      | "preferred_length"
    >
  >,
): Promise<Profile> {
  const { data, error } = await requireSupabase()
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw error;
  return data as Profile;
}

export function experienceFromHistoryCount(count: number): ExperienceLevel {
  if (count >= 8) return "advanced";
  if (count >= 3) return "intermediate";
  return "beginner";
}
