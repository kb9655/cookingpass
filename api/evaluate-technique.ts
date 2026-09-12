import Anthropic from "@anthropic-ai/sdk";
import { errorResponse, json, requireUser } from "./_shared/auth";
import { env } from "./_shared/env";
import {
  evaluationResultJsonSchema,
  evaluationResultSchema,
  evaluateTechniqueRequestSchema,
} from "./_shared/schema";

export const maxDuration = 10;

type Criterion = {
  id: string;
  sort_order: number;
  name: string;
  check_hint: string;
  is_safety: boolean;
};

type TechniqueRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  target_size: string | null;
  capture_hint: string | null;
};

function passedEvaluation(criteria: Criterion[], scoresByOrder: Map<number, number>): boolean {
  const safetyOk = criteria
    .filter((item) => item.is_safety)
    .every((item) => (scoresByOrder.get(item.sort_order) ?? 1) >= 2);
  const achieved = [...scoresByOrder.values()].filter((score) => score >= 2).length;
  return safetyOk && achieved >= 2;
}

export async function POST(req: Request) {
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

  const parsedRequest = evaluateTechniqueRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return errorResponse("사진과 기술 정보가 올바르지 않습니다.", 400);
  }

  const { technique_id, photos, step_number, persist_progress } = parsedRequest.data;
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return errorResponse("Claude API 키가 설정되지 않았습니다. .env의 ANTHROPIC_API_KEY를 확인하세요.", 500);
  }

  const [{ data: technique, error: techniqueError }, { data: criteriaRows, error: criteriaError }, { data: stepRows }] =
    await Promise.all([
      supabase
        .from("techniques")
        .select("id, name, slug, parent_id, target_size, capture_hint")
        .eq("id", technique_id)
        .maybeSingle(),
      supabase
        .from("technique_criteria")
        .select("id, sort_order, name, check_hint, is_safety")
        .eq("technique_id", technique_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("technique_steps")
        .select("step_number, title, instruction")
        .eq("technique_id", technique_id)
        .order("step_number", { ascending: true }),
    ]);

  if (techniqueError || criteriaError) {
    return errorResponse("평가 기준을 불러오지 못했습니다.", 500);
  }
  if (!technique) return errorResponse("해당 학습을 찾을 수 없습니다.", 404);

  const criteria = (criteriaRows ?? []) as Criterion[];
  if (criteria.length !== 3) {
    return errorResponse("이 학습에는 아직 평가 기준이 없습니다.", 400);
  }

  const row = technique as TechniqueRow;
  const currentStep = step_number
    ? (stepRows ?? []).find((step) => step.step_number === step_number)
    : undefined;
  const prompt = [
    "당신은 초심자 요리 연습의 부드러운 코치입니다.",
    "먼저 사진이 이 단계 연습을 보여주는지 판단하세요.",
    "단계 연습이 사진에 보이면 image_relevant는 true, 아니면 false입니다.",
    "요리 연습과 무관하거나 평가 항목을 확인할 수 없으면 image_relevant는 false입니다.",
    "image_relevant가 false이면 점수는 모두 1로 두고, 사진이 맞지 않는다고 짧게 쓰세요.",
    "사진이 맞으면 image_relevant는 true로 두고, 보이는 것만 보고 세 항목을 각각 1, 2, 3점으로 매기세요.",
    "1점: 아직 연습이 필요한 상태. 2점: 대체로 잘 수행함. 3점: 안정적으로 수행함.",
    "완벽하게, 정확히 몇 mm, 정확한 온도 같은 부담스러운 기준은 쓰지 마세요.",
    "사진에 없는 내용은 추측하지 말고, 보이는 범위에서 관대하게 평가하세요.",
    "피드백은 짧은 한국어 한 줄로, 초심자가 다음 연습 포인트를 알게 하세요.",
    `학습: ${row.name}`,
    currentStep
      ? `이번 평가는 ${currentStep.step_number}단계 사진만 봅니다. ${currentStep.title ?? ""} ${currentStep.instruction}`.trim()
      : "",
    row.target_size ? `다지기 목표 크기 참고: ${row.target_size}` : "",
    row.capture_hint ? `촬영 안내: ${row.capture_hint}` : "",
    "평가 항목:",
    ...criteria.map(
      (item) =>
        `${item.sort_order}. ${item.name} — ${item.check_hint}${item.is_safety ? " (안전 항목)" : ""}`,
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const imageBlocks = photos.map((photo) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: photo.mime_type,
      data: photo.data.replace(/^data:[^;]+;base64,/, ""),
    },
  }));

  const client = new Anthropic({ apiKey });
  const model = env("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5";

  let toolInput: unknown;
  try {
    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      tools: [
        {
          name: "submit_technique_evaluation",
          description: "초심자 학습 사진의 세 항목 점수와 다음 연습 포인트를 제출합니다.",
          input_schema: evaluationResultJsonSchema as never,
        },
      ],
      tool_choice: { type: "tool", name: "submit_technique_evaluation" },
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text", text: prompt }],
        },
      ],
    });

    const tool = message.content.find((block) => block.type === "tool_use");
    if (!tool || tool.type !== "tool_use") {
      return errorResponse("Claude 응답에서 구조화 데이터를 찾지 못했습니다.", 502);
    }
    toolInput = tool.input;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Claude API 호출에 실패했습니다.";
    console.error("evaluate-technique Claude error:", message);
    return errorResponse(message, 502);
  }

  const parsed = evaluationResultSchema.safeParse(toolInput);
  if (!parsed.success) {
    return errorResponse("Claude 응답이 예상한 JSON 형식과 다릅니다.", 502);
  }

  const scoresByOrder = new Map(parsed.data.items.map((item) => [item.sort_order, item.score]));
  if (![1, 2, 3].every((order) => scoresByOrder.has(order))) {
    return errorResponse("세 항목 점수가 모두 필요합니다.", 502);
  }

  const imageRelevant = parsed.data.image_relevant;
  const lastItemScores = [1, 2, 3].map((order) => scoresByOrder.get(order) ?? 1);
  const passed = imageRelevant && passedEvaluation(criteria, scoresByOrder);
  const itemScores = criteria.map((item) => ({
    criterion_id: item.id,
    sort_order: item.sort_order,
    name: item.name,
    is_safety: item.is_safety,
    score: scoresByOrder.get(item.sort_order) ?? 1,
    feedback:
      parsed.data.items.find((entry) => entry.sort_order === item.sort_order)?.feedback ?? "",
  }));

  if (imageRelevant) {
    const { error: attemptError } = await supabase.from("user_technique_attempts").insert({
      user_id: user.id,
      technique_id,
      item_scores: itemScores,
      passed,
      headline: parsed.data.headline,
      next_practice: parsed.data.next_practice,
    });
    if (attemptError) {
      return errorResponse("평가 기록을 저장하지 못했습니다.", 500);
    }
  }

  async function upsertProgress(targetId: string, markCleared: boolean) {
    const nextStatus = markCleared
      ? { status: "cleared", cleared_at: new Date().toISOString() }
      : {};
    const { data, error } = await supabase
      .from("user_technique_progress")
      .update({
        last_item_scores: lastItemScores,
        ...nextStatus,
      })
      .eq("user_id", user.id)
      .eq("technique_id", targetId)
      .select("technique_id");
    if (error) throw error;
    if (data && data.length > 0) return;

    const { error: upsertError } = await supabase.from("user_technique_progress").upsert(
      {
        user_id: user.id,
        technique_id: targetId,
        status: markCleared ? "cleared" : "unlocked",
        cleared_at: markCleared ? new Date().toISOString() : null,
        last_item_scores: lastItemScores,
      },
      { onConflict: "user_id,technique_id" },
    );
    if (upsertError) throw upsertError;
  }

  if (persist_progress && imageRelevant) {
    try {
      await upsertProgress(technique_id, passed);
      if (row.parent_id) {
        await upsertProgress(row.parent_id, passed);
      }
    } catch (error) {
      console.error("evaluate-technique progress error:", error);
      return errorResponse("학습 진행도를 저장하지 못했습니다.", 500);
    }
  }

  return json({
    image_relevant: imageRelevant,
    passed,
    headline: parsed.data.headline,
    next_practice: parsed.data.next_practice,
    items: itemScores,
    last_item_scores: lastItemScores,
  });
}

export default POST;
