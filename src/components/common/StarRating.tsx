import { Star } from "lucide-react";

export function StarRating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`난이도 ${value} / 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${index < value ? "fill-accent text-accent" : "text-line"}`}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}
