import { z } from "zod";

export const generateRecipeRequestSchema = z.object({
  recipe_id: z.string().uuid(),
  servings: z.number().int().min(1).max(8),
  notes: z.string().max(500).optional().default(""),
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
  technique_id: z.string().uuid().nullable().optional(),
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
