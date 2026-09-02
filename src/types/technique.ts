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

export type TechniqueProgress = {
  technique_id: string;
  status: TechniqueProgressStatus;
  cleared_at: string | null;
};

export type TechniqueDetail = Technique & {
  steps: TechniqueStep[];
  related: Technique[];
  recipes: { id: string; name: string; slug: string }[];
};
