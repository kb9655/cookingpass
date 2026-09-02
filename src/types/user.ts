export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type Profile = {
  id: string;
  display_name: string | null;
  experience_level: ExperienceLevel;
  available_tools: string[];
  preferred_max_minutes: number | null;
};

export type RecommendationWeights = {
  skill_match: number;
  ingredient_coverage: number;
  difficulty_fit: number;
  time_fit: number;
  tool_fit: number;
  relatedness: number;
};

export type CookingHistory = {
  id: string;
  recipe_id: string;
  recipe_name: string;
  cooked_at: string;
  completed: boolean;
  duration_seconds: number | null;
};
