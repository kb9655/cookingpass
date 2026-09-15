const FRACTIONS: Array<[numerator: number, denominator: number]> = [
  [1, 8],
  [1, 4],
  [1, 3],
  [3, 8],
  [1, 2],
  [5, 8],
  [2, 3],
  [3, 4],
  [7, 8],
];

const TOLERANCE = 1e-3;

function matchFraction(value: number): string | null {
  for (const [numerator, denominator] of FRACTIONS) {
    if (Math.abs(value - numerator / denominator) <= TOLERANCE) {
      return `${numerator}/${denominator}`;
    }
  }
  return null;
}

export function scaleAmount(amount: number, servings: number, baseServings: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (!Number.isFinite(baseServings) || baseServings <= 0) return amount;
  if (!Number.isFinite(servings) || servings <= 0) return amount;
  return (amount * servings) / baseServings;
}

export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute + TOLERANCE);
  const fractionPart = absolute - whole;
  const nearZero = fractionPart <= TOLERANCE;
  const nearOne = 1 - fractionPart <= TOLERANCE;

  if (nearZero) return `${sign}${whole}`;
  if (nearOne) return `${sign}${whole + 1}`;

  const fraction = matchFraction(fractionPart);
  if (fraction) return whole > 0 ? `${sign}${whole} ${fraction}` : `${sign}${fraction}`;

  return `${sign}${Number(absolute.toFixed(2))}`;
}
