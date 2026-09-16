import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export const maxDuration = 60;

function env(name: string): string | undefined {
  return process.env[name];
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

const generateRecipeRequestSchema = z.object({
  recipe_id: z.string().min(1),
  servings: z.number().int().min(1).max(16),
  notes: z.string().max(500).optional().default(""),
  locale: z.enum(["en", "ko"]).optional().default("ko"),
  recipe: z.object({
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
    techniques: z.array(z.object({ id: z.string(), name: z.string() })).optional().default([]),
  }),
  pantry: z
    .array(z.object({ name: z.string().min(1), amount: z.number(), unit: z.string().min(1) }))
    .optional()
    .default([]),
  substitutions: z
    .array(z.object({ original: z.string().min(1), replacement: z.string().min(1) }))
    .optional()
    .default([]),
  missing_tools: z.array(z.string().min(1)).optional().default([]),
});

const adjustedRecipeSchema = z.object({
  title: z.string().min(1),
  servings: z.number().int().min(1),
  notes: z.string().optional(),
  missing_or_substitutions: z.array(z.string()).optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number(),
        unit: z.string().min(1),
        note: z.string().optional(),
        substituted_for: z.string().optional(),
      }),
    )
    .min(1),
  steps: z
    .array(
      z.object({
        step: z.number().int().min(1),
        instruction: z.string().min(1),
        technique_id: z.string().nullable().optional(),
        ingredients: z.array(z.string()).optional(),
        tools: z.array(z.string()).optional(),
        time_minutes: z.number().nullable().optional(),
        temperature: z.string().nullable().optional(),
        warnings: z.array(z.string()).optional(),
      }),
    )
    .min(1),
});

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const mixed = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den) return whole + num / den;
  }
  const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const den = Number(fraction[2]);
    if (den) return Number(fraction[1]) / den;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "name" in item) return asString((item as { name?: unknown }).name) ?? "";
      return asString(item) ?? "";
    })
    .filter(Boolean);
  return items.length ? items : undefined;
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeAdjustedRecipe(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const source = raw as Record<string, unknown>;
  const ingredients = Array.isArray(source.ingredients)
    ? source.ingredients.map((item) => {
        if (!item || typeof item !== "object") return item;
        const row = item as Record<string, unknown>;
        const amount = parseAmount(row.amount);
        const note = asString(row.note ?? row.notes);
        const unit = asString(row.unit) ?? "개";
        const next: Record<string, unknown> = {
          name: asString(row.name) ?? "",
          amount: amount ?? 0,
          unit,
        };
        if (note) next.note = note;
        const substituted = asString(row.substituted_for);
        if (substituted) next.substituted_for = substituted;
        return next;
      })
    : source.ingredients;
  const steps = Array.isArray(source.steps)
    ? source.steps.map((item, index) => {
        if (!item || typeof item !== "object") return item;
        const row = item as Record<string, unknown>;
        const instructionValue = Array.isArray(row.instruction)
          ? row.instruction.map((part) => asString(part) ?? "").filter(Boolean).join(" ")
          : row.instruction;
        const technique = row.technique_id;
        const time = parseAmount(row.time_minutes);
        const next: Record<string, unknown> = {
          step: parseAmount(row.step ?? row.step_number) ?? index + 1,
          instruction: asString(instructionValue) ?? "",
        };
        if (technique == null || technique === "") next.technique_id = null;
        else next.technique_id = asString(technique) ?? null;
        const stepIngredients = asStringList(row.ingredients);
        if (stepIngredients) next.ingredients = stepIngredients;
        const tools = asStringList(row.tools);
        if (tools) next.tools = tools;
        next.time_minutes = time;
        const temperature = asString(row.temperature);
        next.temperature = temperature ?? null;
        const warnings = asStringList(row.warnings);
        if (warnings) next.warnings = warnings;
        return next;
      })
    : source.steps;

  const servings = parseAmount(source.servings);
  const notes = asString(source.notes);
  const missing = asStringList(source.missing_or_substitutions);
  const next: Record<string, unknown> = {
    title: asString(source.title) ?? "",
    servings: servings != null ? Math.max(1, Math.round(servings)) : undefined,
    ingredients,
    steps,
  };
  if (notes) next.notes = notes;
  if (missing) next.missing_or_substitutions = missing;
  return next;
}

const adjustedRecipeJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "servings", "ingredients", "steps"],
  properties: {
    title: { type: "string" },
    servings: { type: "integer" },
    notes: { type: "string" },
    missing_or_substitutions: { type: "array", items: { type: "string" } },
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

async function handlePost(req: Request) {
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

  const { recipe_id, servings, notes, locale, recipe, pantry, substitutions, missing_tools } =
    parsedRequest.data;
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
    "반드시 아래 네 가지를 수행하세요.",
    "1) 원본 directions를 번호 있는 단계로 재구성하고, 한 단계에 한 가지 행동만 담으세요.",
    "2) notes에 적힌 수정 요청(맵기, 시간, 도구 등)을 단계와 재료에 반영하세요.",
    "3) 보유 재료에 없는 항목은 사용자가 고른 대체를 쓰고, substituted_for에 원래 재료 이름을 넣으세요. 고른 대체가 없으면 현실적인 대체나 생략을 하세요.",
    "4) missing_tools에 있는 도구 없이 비슷한 결과가 나오도록 단계와 도구를 바꾸세요. 예: 오븐 없이 팬이나 에어프라이어.",
    locale === "en"
      ? "Write steps in clear English. Keep ingredient names explicit for originals and substitutes."
      : "단계는 한국어로 쉽게 쓰고, 재료 이름은 원문과 대체명을 명확히 남기세요. 단위는 한국어로 쓰세요. count는 개, cup은 컵, tablespoon은 큰술, teaspoon은 작은술입니다. 마땅한 한글이 없으면 음차로 쓰세요.",
    "technique_id는 제공된 기술 id만 사용하고, 없으면 null로 두세요.",
    "기다리는 행동(끓이기, 굽기, 재우기, 식히기, 삶기, 찌기, 오븐 등)만 time_minutes에 분을 넣고, 썰기·섞기처럼 바로 끝나는 단계는 null로 두세요.",
    "",
    `기존 레시피: ${recipe.name}`,
    `설명: ${recipe.description}`,
    `원래 인분: ${recipe.servings ?? 2}`,
    `요청 인분: ${servings}`,
    `조리 도구: ${recipe.required_tools.join(", ") || "없음"}`,
    `없는 조리 도구: ${missing_tools.join(", ") || "없음"}`,
    `사용자 선택사항: ${notes || "없음"}`,
    `사용자가 고른 대체: ${JSON.stringify(substitutions)}`,
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
      max_tokens: 8192,
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
    if (tool && tool.type === "tool_use") {
      toolInput = tool.input;
    } else {
      const text = message.content
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("\n");
      toolInput = extractJsonObject(text);
      if (toolInput == null) {
        return errorResponse("레시피를 조정하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claude API 호출에 실패했습니다.";
    console.error("generate-recipe Claude error:", message);
    return errorResponse("레시피를 조정하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }

  const parsedRecipe = adjustedRecipeSchema.safeParse(normalizeAdjustedRecipe(toolInput));
  if (!parsedRecipe.success) {
    console.error("generate-recipe schema issues:", parsedRecipe.error.flatten());
    return errorResponse("레시피를 조정하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }

  return json({ recipe: parsedRecipe.data });
}

async function writeNodeResponse(
  res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string | Buffer) => void },
  response: Response,
) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  res.end(Buffer.from(await response.arrayBuffer()));
}

export async function POST(
  req: Request,
  res?: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: string | Buffer) => void },
) {
  const request =
    req instanceof Request
      ? req
      : new Request("https://vercel.local/api/generate-recipe", {
          method: "POST",
          body: JSON.stringify((req as { body?: unknown }).body ?? {}),
        });
  const response = await handlePost(request);
  if (res && !(req instanceof Request)) {
    await writeNodeResponse(res, response);
    return;
  }
  return response;
}

export default POST;
