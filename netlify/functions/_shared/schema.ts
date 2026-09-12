import { z } from "zod";

export const pantryItemSchema = z.object({
  name: z.string().min(1),
  amount: z.number(),
  unit: z.string().min(1),
});

export const recipeSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(""),
  servings: z.number().int().min(1).optional(),
  required_tools: z.array(z.string()).optional().default([]),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number(),
        unit: z.string().min(1),
        notes: z.string().nullable().optional(),
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        step_number: z.number().int().min(1),
        instruction: z.string().min(1),
        technique_id: z.string().nullable().optional(),
      }),
    )
    .min(1),
  techniques: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export const generateRecipeRequestSchema = z.object({
  recipe_id: z.string().min(1),
  servings: z.number().int().min(1).max(8),
  notes: z.string().max(500).optional().default(""),
  locale: z.enum(["en", "ko"]).optional().default("ko"),
  recipe: recipeSnapshotSchema,
  pantry: z.array(pantryItemSchema).optional().default([]),
});

export const adjustedIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number(),
  unit: z.string().min(1),
  note: z.string().optional(),
  substituted_for: z.string().optional(),
});

export const adjustedStepSchema = z.object({
  step: z.number().int().min(1),
  instruction: z.string().min(1),
  technique_id: z.string().nullable().optional(),
  ingredients: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  time_minutes: z.number().nullable().optional(),
  temperature: z.string().nullable().optional(),
  warnings: z.array(z.string()).optional(),
});

export const adjustedRecipeSchema = z.object({
  title: z.string().min(1),
  servings: z.number().int().min(1),
  notes: z.string().optional(),
  missing_or_substitutions: z.array(z.string()).optional(),
  ingredients: z.array(adjustedIngredientSchema).min(1),
  steps: z.array(adjustedStepSchema).min(1),
});

export type AdjustedRecipe = z.infer<typeof adjustedRecipeSchema>;

export const evaluatePhotoSchema = z.object({
  step_number: z.number().int().min(1),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(80).max(1_400_000),
});

export const evaluateTechniqueRequestSchema = z.object({
  technique_id: z.string().uuid(),
  photos: z.array(evaluatePhotoSchema).min(1).max(4),
  step_number: z.number().int().min(1).optional(),
  persist_progress: z.boolean().optional(),
});

export const evaluationItemSchema = z.object({
  sort_order: z.number().int().min(1).max(3),
  score: z.number().int().min(1).max(3),
  feedback: z.string().min(1).max(240),
});

export const evaluationResultSchema = z.object({
  items: z.array(evaluationItemSchema).length(3),
  headline: z.string().min(1).max(80),
  next_practice: z.string().min(1).max(160),
});

export const evaluationResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "headline", "next_practice"],
  properties: {
    items: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sort_order", "score", "feedback"],
        properties: {
          sort_order: { type: "integer", minimum: 1, maximum: 3 },
          score: { type: "integer", minimum: 1, maximum: 3 },
          feedback: { type: "string" },
        },
      },
    },
    headline: { type: "string" },
    next_practice: { type: "string" },
  },
};

export const adjustedRecipeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "servings", "ingredients", "steps"],
  properties: {
    title: { type: "string" },
    servings: { type: "integer" },
    notes: { type: "string" },
    missing_or_substitutions: {
      type: "array",
      items: { type: "string" },
    },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "amount", "unit"],
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          unit: { type: "string" },
          note: { type: "string" },
          substituted_for: { type: "string" },
        },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step", "instruction"],
        properties: {
          step: { type: "integer" },
          instruction: { type: "string" },
          technique_id: { type: ["string", "null"] },
          ingredients: { type: "array", items: { type: "string" } },
          tools: { type: "array", items: { type: "string" } },
          time_minutes: { type: ["number", "null"] },
          temperature: { type: ["string", "null"] },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};
