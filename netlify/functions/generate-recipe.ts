import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { errorResponse, json, requireUser } from "./_shared/auth";
import { env } from "./_shared/env";
import {
  adjustedRecipeSchema,
  adjustedRecipeJsonSchema,
  generateRecipeRequestSchema,
} from "./_shared/schema";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return errorResponse("POST만 허용됩니다.", 405);
  }

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("요청 본문이 JSON이 아닙니다.", 400);
  }

  const parsedRequest = generateRecipeRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return errorResponse("요청 데이터가 올바르지 않습니다.", 400);
  }

  const { recipe_id, servings, notes } = parsedRequest.data;

  const [{ data: recipe, error: recipeError }, { data: pantry, error: pantryError }, { data: profile }] =
    await Promise.all([
      supabase
        .from("recipes")
        .select(
          "id, name, description, servings, required_tools, recipe_ingredients(amount, unit, notes, ingredients(name)), recipe_steps(step_number, instruction, technique_id), recipe_techniques(technique_id, techniques(id, name))",
        )
        .eq("id", recipe_id)
        .maybeSingle(),
      supabase
        .from("user_ingredients")
        .select("amount, unit, ingredients(name)")
        .eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("available_tools, experience_level")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (recipeError || pantryError) {
    return errorResponse("레시피 또는 보유 재료를 확인하지 못했습니다.", 500);
  }
  if (!recipe) {
    return errorResponse("레시피를 찾을 수 없습니다.", 404);
  }

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return errorResponse("Claude API 키가 설정되지 않았습니다.", 500);
  }

  const originalIngredients = ((recipe.recipe_ingredients as Array<{
    amount: number;
    unit: string;
    notes: string | null;
    ingredients: { name: string } | { name: string }[] | null;
  }>) ?? []).map((row) => {
    const ingredient = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    return {
      name: ingredient?.name ?? "재료",
      amount: Number(row.amount),
      unit: row.unit,
      notes: row.notes,
    };
  });

  const originalSteps = ((recipe.recipe_steps as Array<{
    step_number: number;
    instruction: string;
    technique_id: string | null;
  }>) ?? []).sort((a, b) => a.step_number - b.step_number);

  const techniques = ((recipe.recipe_techniques as Array<{
    technique_id: string;
    techniques: { id: string; name: string } | { id: string; name: string }[] | null;
  }>) ?? []).map((row) => {
    const technique = Array.isArray(row.techniques) ? row.techniques[0] : row.techniques;
    return { id: row.technique_id, name: technique?.name ?? "" };
  });

  const pantryItems = ((pantry ?? []) as Array<{
    amount: number;
    unit: string;
    ingredients: { name: string } | { name: string }[] | null;
  }>).map((row) => {
    const ingredient = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    return {
      name: ingredient?.name ?? "재료",
      amount: Number(row.amount),
      unit: row.unit,
    };
  });

  const prompt = [
    "당신은 가정 요리 도우미입니다. 추천이나 권한 판단은 하지 말고, 주어진 레시피를 사용자 보유 재료에 맞게 조정하세요.",
    "부족한 재료는 현실적인 대체안을 제안하고, 인분과 용량을 맞춰 단계별 설명을 쉽게 쓰세요.",
    "technique_id는 제공된 기술 id만 사용하고, 없으면 null로 두세요.",
    "",
    `기존 레시피: ${recipe.name}`,
    `설명: ${recipe.description}`,
    `원래 인분: ${recipe.servings}`,
    `요청 인분: ${servings}`,
    `조리 도구: ${(recipe.required_tools as string[] | null)?.join(", ") ?? ""}`,
    `사용자 도구: ${(profile?.available_tools as string[] | undefined)?.join(", ") ?? ""}`,
    `경험 수준: ${profile?.experience_level ?? "beginner"}`,
    `사용자 선택사항: ${notes || "없음"}`,
    `기존 재료: ${JSON.stringify(originalIngredients)}`,
    `기존 단계: ${JSON.stringify(originalSteps)}`,
    `연결 기술: ${JSON.stringify(techniques)}`,
    `사용자 보유 재료: ${JSON.stringify(pantryItems)}`,
  ].join("\n");

  const client = new Anthropic({ apiKey });
  const model = env("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5";

  let toolInput: unknown;
  try {
    const message = await client.messages.create({
      model,
      max_tokens: 4096,
      tools: [
        {
          name: "submit_adjusted_recipe",
          description: "보유 재료에 맞춰 조정된 레시피를 구조화해 제출합니다.",
          input_schema: adjustedRecipeJsonSchema as never,
        },
      ],
      tool_choice: { type: "tool", name: "submit_adjusted_recipe" },
      messages: [{ role: "user", content: prompt }],
    });

    const tool = message.content.find((block) => block.type === "tool_use");
    if (!tool || tool.type !== "tool_use") {
      return errorResponse("Claude 응답에서 구조화 데이터를 찾지 못했습니다.", 502);
    }
    toolInput = tool.input;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claude API 호출에 실패했습니다.";
    return errorResponse(message, 502);
  }

  const parsedRecipe = adjustedRecipeSchema.safeParse(toolInput);
  if (!parsedRecipe.success) {
    return errorResponse("Claude 응답이 예상한 JSON 형식과 다릅니다.", 502);
  }

  return json({ recipe: parsedRecipe.data });
};

export const config: Config = {
  path: "/api/generate-recipe",
  method: "POST",
};
