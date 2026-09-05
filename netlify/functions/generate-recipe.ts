import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { errorResponse, json } from "./_shared/auth";
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

  const { recipe_id, servings, notes, locale, recipe, pantry } = parsedRequest.data;
  if (recipe.id !== recipe_id) {
    return errorResponse("레시피 식별자가 일치하지 않습니다.", 400);
  }

  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return errorResponse("Claude API 키가 설정되지 않았습니다. .env의 ANTHROPIC_API_KEY를 확인하세요.", 500);
  }

  const originalIngredients = recipe.ingredients.map((item) => ({
    name: item.name,
    amount: item.amount,
    unit: item.unit,
    notes: item.notes ?? null,
  }));
  const originalSteps = [...recipe.steps].sort((a, b) => a.step_number - b.step_number);
  const techniques = recipe.techniques ?? [];

  const prompt = [
    "당신은 가정 요리 도우미입니다. 추천이나 권한 판단은 하지 말고, 주어진 레시피를 사용자 보유 재료와 요청에 맞게 조정하세요.",
    "반드시 아래 세 가지를 수행하세요.",
    "1) 원본 directions를 번호 있는 단계로 재구성하고, 한 단계에 한 가지 행동만 담으세요.",
    "2) notes에 적힌 수정 요청(맵기, 시간, 도구 등)을 단계와 재료에 반영하세요.",
    "3) 보유 재료에 없는 항목은 현실적인 대체 재료를 쓰고, substituted_for에 원래 재료 이름을 넣으세요.",
    locale === "en"
      ? "Write steps in clear English. Keep ingredient names explicit for originals and substitutes."
      : "단계는 한국어로 쉽게 쓰고, 재료 이름은 원문과 대체명을 명확히 남기세요.",
    "technique_id는 제공된 기술 id만 사용하고, 없으면 null로 두세요.",
    "",
    `기존 레시피: ${recipe.name}`,
    `설명: ${recipe.description}`,
    `원래 인분: ${recipe.servings ?? 2}`,
    `요청 인분: ${servings}`,
    `조리 도구: ${recipe.required_tools.join(", ") || "없음"}`,
    `사용자 선택사항: ${notes || "없음"}`,
    `기존 재료: ${JSON.stringify(originalIngredients)}`,
    `기존 단계: ${JSON.stringify(originalSteps)}`,
    `연결 기술: ${JSON.stringify(techniques)}`,
    `사용자 보유 재료: ${JSON.stringify(pantry)}`,
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
          description: "보유 재료와 수정 요청에 맞춰 단계화된 레시피를 구조화해 제출합니다.",
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
