export type TechniqueProgressStatus = "locked" | "unlocked" | "cleared";

export type Technique = {
  id: string;
  slug: string;
  name: string;
  description: string;
  difficulty: number;
  estimated_minutes: number;
  learning_goals: string[];
  required_tools: string[];
  precautions: string[];
  stage_number: number;
  parent_id?: string | null;
  target_size?: string | null;
  capture_hint?: string | null;
};

export type TechniqueStep = {
  id: string;
  technique_id: string;
  step_number: number;
  title: string | null;
  instruction: string;
  media_id: string | null;
  media: import("./media").Media | null;
};

export type TechniqueCriterion = {
  id: string;
  technique_id: string;
  sort_order: number;
  name: string;
  check_hint: string;
  is_safety: boolean;
};

export type TechniqueProgress = {
  technique_id: string;
  status: TechniqueProgressStatus;
  cleared_at: string | null;
  last_item_scores?: number[] | null;
};

export type TechniqueEvaluationItem = {
  criterion_id: string;
  sort_order: number;
  name: string;
  is_safety: boolean;
  score: number;
  feedback: string;
};

export type TechniqueEvaluation = {
  passed: boolean;
  headline: string;
  next_practice: string;
  items: TechniqueEvaluationItem[];
  last_item_scores: number[];
};

export type TechniqueDetail = Technique & {
  steps: TechniqueStep[];
  related: Technique[];
  criteria: TechniqueCriterion[];
  children: Technique[];
};
