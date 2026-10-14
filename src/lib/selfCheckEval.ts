import type { TechniqueCriterion, TechniqueEvaluation } from "../types/technique";

export function safetyChecksComplete(criteria: TechniqueCriterion[], checkedIds: Set<string>): boolean {
  const safety = criteria.filter((item) => item.is_safety);
  if (safety.length === 0) return true;
  return safety.every((item) => checkedIds.has(item.id));
}

export function evaluationFromChecks(
  criteria: TechniqueCriterion[],
  checkedIds: Set<string>,
): TechniqueEvaluation {
  const items = [...criteria]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => {
      const checked = checkedIds.has(item.id);
      return {
        criterion_id: item.id,
        sort_order: item.sort_order,
        name: item.name,
        is_safety: item.is_safety,
        score: checked ? 3 : 1,
        feedback: item.check_hint || item.name,
      };
    });

  const scores = [1, 1, 1];
  for (const item of items) {
    const index = Math.min(2, Math.max(0, item.sort_order - 1));
    scores[index] = Math.max(scores[index], item.score);
  }
  if (items.length === 0) {
    scores[0] = 3;
    scores[1] = 3;
    scores[2] = 3;
  }

  const safetyOk = safetyChecksComplete(criteria, checkedIds);
  const achieved = scores.filter((score) => score >= 2).length;
  const passed = (items.length === 0 || safetyOk) && achieved >= 2;

  return {
    passed,
    headline: passed ? "" : "",
    next_practice: "",
    items,
    last_item_scores: scores,
  };
}
