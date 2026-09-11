import { Star } from "lucide-react";

function starClass(score: number | null): string {
  if (score === 3) return "fill-[#2f8f4e] text-[#2f8f4e]";
  if (score === 2) return "fill-[#e08a1e] text-[#e08a1e]";
  if (score === 1) return "fill-[#d14b4b] text-[#d14b4b]";
  return "fill-line text-line";
}

export function ScoreStars({
  scores,
  label,
}: {
  scores?: number[] | null;
  label?: string;
}) {
  const items = [0, 1, 2].map((index) => scores?.[index] ?? null);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label ?? "학습 점수"}>
      {items.map((score, index) => (
        <Star key={index} className={`h-4 w-4 ${starClass(score)}`} strokeWidth={1.75} />
      ))}
    </span>
  );
}
