import type { Locale } from "../i18n/messages";

const KO_UNITS: Record<string, string> = {
  count: "개",
  ea: "개",
  piece: "개",
  pieces: "개",
  cup: "컵",
  cups: "컵",
  tablespoon: "큰술",
  tablespoons: "큰술",
  tbsp: "큰술",
  teaspoon: "작은술",
  teaspoons: "작은술",
  tsp: "작은술",
  ounce: "온스",
  ounces: "온스",
  oz: "온스",
  pound: "파운드",
  pounds: "파운드",
  lb: "파운드",
  lbs: "파운드",
  clove: "쪽",
  cloves: "쪽",
  slice: "장",
  slices: "장",
  pinch: "꼬집",
  pinches: "꼬집",
  dash: "약간",
  dashes: "약간",
  "to taste": "약간",
  can: "캔",
  cans: "캔",
  package: "팩",
  packages: "팩",
  packet: "팩",
  packets: "팩",
  bunch: "단",
  bunches: "단",
  stalk: "줄기",
  stalks: "줄기",
  sprig: "가지",
  sprigs: "가지",
  leaf: "장",
  leaves: "장",
  head: "통",
  heads: "통",
  stick: "대",
  sticks: "대",
  drop: "방울",
  drops: "방울",
  quart: "쿼트",
  quarts: "쿼트",
  pint: "파인트",
  pints: "파인트",
  gallon: "갤런",
  gallons: "갤런",
  liter: "리터",
  liters: "리터",
  litre: "리터",
  litres: "리터",
  gram: "g",
  grams: "g",
  g: "g",
  kg: "kg",
  inch: "인치",
  inches: "인치",
  in: "인치",
  cm: "cm",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
};

const SYLLABLES: Record<string, string> = {
  a: "아",
  e: "에",
  i: "이",
  o: "오",
  u: "우",
  y: "이",
  b: "브",
  c: "크",
  d: "드",
  f: "프",
  g: "그",
  h: "흐",
  j: "지",
  k: "크",
  l: "르",
  m: "므",
  n: "느",
  p: "프",
  q: "크",
  r: "르",
  s: "스",
  t: "트",
  v: "브",
  w: "우",
  x: "크스",
  z: "즈",
};

function transliterateLatin(unit: string): string {
  return [...unit.toLowerCase()]
    .map((ch) => (ch === "-" || ch === " " ? " " : (SYLLABLES[ch] ?? ch)))
    .join("");
}

export function formatUnit(unit: string, locale: Locale = "ko"): string {
  const trimmed = unit.trim();
  if (!trimmed) return locale === "ko" ? "개" : "count";
  if (locale !== "ko") return trimmed;
  if (/[\uac00-\ud7a3]/.test(trimmed)) return trimmed;

  const key = trimmed.toLowerCase().replace(/[.]/g, "");
  if (KO_UNITS[key]) return KO_UNITS[key];

  const singular = key.endsWith("es") ? key.slice(0, -2) : key.endsWith("s") ? key.slice(0, -1) : key;
  if (KO_UNITS[singular]) return KO_UNITS[singular];

  if (/^(mg|mcg|l|dl|cl|cm|mm|in)$/i.test(key)) return key;
  return transliterateLatin(key);
}
