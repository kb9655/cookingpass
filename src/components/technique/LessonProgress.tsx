export function LessonProgress({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  if (total <= 0) return null;
  return (
    <ol className="flex items-center justify-center gap-2 pt-1" aria-label={`${current + 1} / ${total}`}>
      {Array.from({ length: total }, (_, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={index}
            className={`h-2.5 w-2.5 rounded-full border ${
              active
                ? "border-accent bg-accent"
                : done
                  ? "border-progress-done bg-progress-done"
                  : "border-line bg-white"
            }`}
          >
            <span className="sr-only">
              {done ? "done" : active ? "current" : "todo"} {index + 1}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
