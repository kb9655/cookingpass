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

const requestSchema = z.object({
  locale: z.enum(["en", "ko"]).optional().default("ko"),
  recipe_name: z.string().min(1),
  missing: z
    .array(
      z.object({
        name: z.string().min(1),
        amount: z.number().optional(),
        unit: z.string().optional(),
      }),
    )
    .min(1)
    .max(40),
  pantry: z
    .array(z.object({ name: z.string().min(1), amount: z.number(), unit: z.string().min(1) }))
    .optional()
    .default([]),
});

const suggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        original: z.string().min(1),
        options: z.array(z.string().min(1)).max(3),
      }),
    )
    .min(1),
});

const suggestionsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "options"],
        properties: {
          original: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
        },
      },
    },
  },
};

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
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

function normalizeSuggestions(raw: unknown, missingNames: string[]): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const source = raw as Record<string, unknown>;
  const rows = Array.isArray(source.suggestions) ? source.suggestions : [];
  const byOriginal = new Map<string, string[]>();
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const original = asString(row.original);
    if (!original) continue;
    const options = Array.isArray(row.options)
      ? row.options.map((option) => asString(option) ?? "").filter(Boolean)
      : [];
    byOriginal.set(original, [...new Set(options)].slice(0, 3));
  }

  return {
    suggestions: missingNames.map((name) => {
      const match =
        byOriginal.get(name) ??
        [...byOriginal.entries()].find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1] ??
        [];
      return { original: name, options: match.slice(0, 3) };
    }),
  };
}

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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("요청 데이터가 올바르지 않습니다.", 400);
  }

  const { locale, recipe_name, missing, pantry } = parsed.data;
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return errorResponse("Claude API 키가 설정되지 않았습니다. .env의 ANTHROPIC_API_KEY를 확인하세요.", 500);
  }

  const prompt = [
    "당신은 가정 요리 도우미입니다. 없는 재료마다 현실적인 대체 후보를 정확히 3개씩 제안하세요.",
    "추천이나 권한 판단은 하지 마세요. 흔한 마트 재료 위주로, 맛과 역할이 비슷한 대체를 고르세요.",
    "보유 재료에 이미 있는 이름이 있으면 그 후보를 앞에 두세요.",
    locale === "en"
      ? "Write substitute names in English."
      : "대체 재료 이름은 한국어로 쓰세요.",
    "",
    `레시피: ${recipe_name}`,
    `없는 재료: ${JSON.stringify(missing)}`,
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
          name: "submit_substitutes",
          description: "없는 재료마다 대체 후보 3개를 제출합니다.",
          input_schema: suggestionsJsonSchema as never,
        },
      ],
      tool_choice: { type: "tool", name: "submit_substitutes" },
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
        return errorResponse("대체 재료를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claude API 호출에 실패했습니다.";
    console.error("suggest-substitutes Claude error:", message);
    return errorResponse("대체 재료를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }

  const missingNames = missing.map((item) => item.name);
  const parsedSuggestions = suggestionsSchema.safeParse(normalizeSuggestions(toolInput, missingNames));
  if (!parsedSuggestions.success) {
    console.error("suggest-substitutes schema issues:", parsedSuggestions.error.flatten());
    return errorResponse("대체 재료를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }

  return json({ suggestions: parsedSuggestions.data.suggestions });
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
      : new Request("https://vercel.local/api/suggest-substitutes", {
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
