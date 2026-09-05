import type { RecipeIngredient } from "./ingredient";
import type { Technique } from "./technique";

export type Recipe = {
  id: string;
  slug: string;
  name: string;
  description: string;
  difficulty: number;
  estimated_minutes: number;
  servings: number;
  required_tools: string[];
  category: string;
  subcategory: string;
  source_dataset: string;
};

export type RecipeStep = {
  id: string;
  recipe_id: string;
  step_number: number;
  instruction: string;
  technique_id: string | null;
};

export type RecipeDetail = Recipe & {
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  techniques: (Technique & { is_primary: boolean })[];
};

export type AdjustedIngredient = {
  name: string;
  amount: number;
  unit: string;
  note?: string;
  substituted_for?: string;
};

export type AdjustedStep = {
  step: number;
  instruction: string;
  technique_id?: string | null;
  ingredients?: string[];
  tools?: string[];
  time_minutes?: number | null;
  temperature?: string | null;
  warnings?: string[];
};

export type AdjustedRecipe = {
  title: string;
  servings: number;
  notes?: string;
  missing_or_substitutions?: string[];
  ingredients: AdjustedIngredient[];
  steps: AdjustedStep[];
};

export type ScoredRecipe = Recipe & {
  score: number;
  skill_match: number;
  pantry_coverage: number;
  difficulty_fit: number;
  time_fit: number;
  tool_fit: number;
  relatedness: number;
};
