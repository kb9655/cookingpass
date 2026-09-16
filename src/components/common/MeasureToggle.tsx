import { useMeasure } from "../../i18n/measure";
import { useLocale } from "../../i18n/locale";
import type { MeasurePrefs, MeasureSystem } from "../../lib/formatMeasure";
import type { MessageKey } from "../../i18n/messages";

const AXES: Array<{
  axis: keyof MeasurePrefs;
  label: MessageKey;
  ko: MessageKey;
  us: MessageKey;
}> = [
  { axis: "mass", label: "measureMass", ko: "measureMassKo", us: "measureMassUs" },
  { axis: "volume", label: "measureVolume", ko: "measureVolumeKo", us: "measureVolumeUs" },
  { axis: "length", label: "measureLength", ko: "measureLengthKo", us: "measureLengthUs" },
];

const OPTIONS: MeasureSystem[] = ["ko", "us"];

export function MeasureToggle({ className = "" }: { className?: string }) {
  const { t } = useLocale();
  const { prefs, setAxis } = useMeasure();

  return (
    <div className={className}>
      <p className="text-sm font-medium">{t("measure")}</p>
      <div className="mt-3 space-y-4">
        {AXES.map((row) => (
          <div key={row.axis}>
            <p className="text-xs text-muted">{t(row.label)}</p>
            <div className="mt-2 flex gap-2">
              {OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-full px-3 py-1 text-sm ${
                    prefs[row.axis] === value ? "bg-accent text-white" : "border border-line"
                  }`}
                  onClick={() => setAxis(row.axis, value)}
                >
                  {t(value === "ko" ? row.ko : row.us)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
