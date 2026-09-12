import { useId } from "react";

function starStops(score: number | null): [string, string, string] {
  if (score === 3) return ["#8be8a4", "#2f8f4e", "#176338"];
  if (score === 2) return ["#ffd36a", "#e08a1e", "#b86a0c"];
  if (score === 1) return ["#ff9b8c", "#d14b4b", "#9d2d2d"];
  return ["#f4f7f5", "#d7e0db", "#c5d0ca"];
}

function GlossStar({
  score,
  size,
  animate,
  delay,
}: {
  score: number | null;
  size: number;
  animate: boolean;
  delay: number;
}) {
  const rawId = useId().replace(/:/g, "");
  const [hi, mid, lo] = starStops(score);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={animate && score != null ? "star-pop" : undefined}
      style={animate && score != null ? { animationDelay: `${delay}ms` } : undefined}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${rawId}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hi} />
          <stop offset="45%" stopColor={mid} />
          <stop offset="100%" stopColor={lo} />
        </linearGradient>
      </defs>
      <path
        d="M12 2.4l2.7 6.1 6.6.7-5 4.6 1.4 6.5L12 16.9 6.3 20.3 7.7 13.8 2.7 9.2l6.6-.7L12 2.4z"
        fill={`url(#${rawId}-g)`}
        stroke={lo}
        strokeWidth="0.7"
      />
      <path
        d="M12 4.2l1.5 3.4.4.1"
        fill="none"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ScoreStars({
  scores,
  label,
  animate = false,
  size = "sm",
}: {
  scores?: number[] | null;
  label?: string;
  animate?: boolean;
  size?: "sm" | "lg";
}) {
  const items = [0, 1, 2].map((index) => scores?.[index] ?? null);
  const px = size === "lg" ? 44 : 16;
  return (
    <span
      className={`inline-flex items-center ${size === "lg" ? "gap-2" : "gap-0.5"}`}
      aria-label={label ?? "학습 점수"}
    >
      {items.map((score, index) => (
        <GlossStar
          key={index}
          score={score}
          size={px}
          animate={animate}
          delay={index * 120}
        />
      ))}
    </span>
  );
}
