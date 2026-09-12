import { useEffect, useState } from "react";

const STORAGE_KEY = "cookingpass:progress-percent";

function readStoredPercent(): number | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function ProgressBar({ value }: { value: number }) {
  const [width, setWidth] = useState(() => readStoredPercent() ?? value);

  useEffect(() => {
    const previous = readStoredPercent();
    const from = previous === null || previous > value ? value : previous;
    setWidth(from);

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setWidth(value);
        sessionStorage.setItem(STORAGE_KEY, String(value));
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
      <div className="progress-fill h-full bg-accent" style={{ width: `${width}%` }} />
    </div>
  );
}
