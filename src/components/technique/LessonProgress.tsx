export function LessonProgress({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  if (total <= 0) return null;
  return (
    <ol className="flex max-w-full flex-wrap items-center justify-center gap-2 px-2 pt-1" aria-label={`${current + 1} / ${total}`}>
      {Array.from({ length: total }, (_, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li
            key={index}
            className={`h-3 w-3 rounded-full border-2 ${
              active
                ? "border-accent bg-accent shadow-[0_2px_0_#16553a]"
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
