import type { Locale } from "../i18n/messages";
import { formatAmount, roundAmount } from "./formatAmount";
import { formatUnit } from "./formatUnit";

export type MeasureSystem = "ko" | "us";

export type MeasurePrefs = {
  mass: MeasureSystem;
  volume: MeasureSystem;
  length: MeasureSystem;
};

export function prefsFromSystem(system: MeasureSystem): MeasurePrefs {
  return { mass: system, volume: system, length: system };
}

type Canonical =
  | { kind: "mass"; grams: number }
  | { kind: "volume"; ml: number }
  | { kind: "length"; inches: number }
  | { kind: "other"; amount: number; unit: string };

const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  dl: 100,
  cl: 10,
  cup: 240,
  cups: 240,
  "컵": 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  "큰술": 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  "작은술": 5,
  floz: 29.5735,
  pint: 473.176,
  pints: 473.176,
  quart: 946.353,
  quarts: 946.353,
  gallon: 3785.41,
  gallons: 3785.41,
};

const LENGTH_TO_INCH: Record<string, number> = {
  in: 1,
  inch: 1,
  inches: 1,
  "인치": 1,
  cm: 1 / 2.54,
  centimeter: 1 / 2.54,
  centimeters: 1 / 2.54,
  millimetre: 1 / 25.4,
  millimetres: 1 / 25.4,
  mm: 1 / 25.4,
};

const COUNT_UNITS = new Set(["count", "ea", "piece", "pieces", "개"]);

const SKIP_UNITS = new Set(["pinch", "pinches", "dash", "dashes", "to taste", "약간"]);

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ");
}

function unitKey(unit: string): string {
  const key = normalizeUnit(unit).replace(/ /g, "");
  if (key === "fluidounce" || key === "fluidounces" || key === "floz") return "floz";
  return key;
}

function canonical(amount: number, unit: string): Canonical {
  const key = unitKey(unit);
  if (SKIP_UNITS.has(normalizeUnit(unit)) || SKIP_UNITS.has(key)) {
    return { kind: "other", amount, unit };
  }
  if (MASS_TO_GRAMS[key] != null) {
    return { kind: "mass", grams: amount * MASS_TO_GRAMS[key] };
  }
  if (VOLUME_TO_ML[key] != null) {
    return { kind: "volume", ml: amount * VOLUME_TO_ML[key] };
  }
  if (LENGTH_TO_INCH[key] != null) {
    return { kind: "length", inches: amount * LENGTH_TO_INCH[key] };
  }
  return { kind: "other", amount, unit };
}

function roundDisplay(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const absolute = Math.abs(value);
  if (absolute >= 100) return roundAmount(value, 0);
  if (absolute >= 10) return roundAmount(value, 1);
  return roundAmount(value, 2);
}

function fromMass(grams: number, system: MeasureSystem): { amount: number; unit: string } {
  if (system === "ko") {
    if (grams >= 1000) return { amount: roundDisplay(grams / 1000), unit: "kg" };
    return { amount: roundDisplay(grams), unit: "g" };
  }
  const oz = grams / 28.3495;
  if (oz >= 16) return { amount: roundDisplay(oz / 16), unit: "lb" };
  return { amount: roundDisplay(oz), unit: "oz" };
}

function fromVolume(ml: number, system: MeasureSystem): { amount: number; unit: string } {
  const cups = ml / 240;
  if (cups >= 0.25) {
    return { amount: roundDisplay(cups), unit: system === "ko" ? "컵" : "cup" };
  }
  const tbsp = ml / 15;
  if (tbsp >= 1) {
    return { amount: roundDisplay(tbsp), unit: system === "ko" ? "큰술" : "tbsp" };
  }
  return { amount: roundDisplay(ml / 5), unit: system === "ko" ? "작은술" : "tsp" };
}

function fromLength(inches: number, system: MeasureSystem): { amount: number; unit: string } {
  if (system === "ko") return { amount: roundDisplay(inches * 2.54), unit: "cm" };
  return { amount: roundDisplay(inches), unit: "inch" };
}

export function toDisplayMeasure(
  amount: number,
  unit: string,
  prefs: MeasurePrefs,
): { amount: number; unit: string } {
  const value = canonical(amount, unit);
  if (value.kind === "mass") return fromMass(value.grams, prefs.mass);
  if (value.kind === "volume") return fromVolume(value.ml, prefs.volume);
  if (value.kind === "length") return fromLength(value.inches, prefs.length);
  const key = unitKey(unit);
  if (COUNT_UNITS.has(key) || COUNT_UNITS.has(normalizeUnit(unit))) {
    return { amount: roundDisplay(amount), unit: prefs.mass === "ko" ? "개" : "count" };
  }
  return { amount: roundDisplay(amount), unit };
}

export function convertAmount(amount: number, fromUnit: string, toUnit: string): number {
  const from = canonical(amount, fromUnit);
  const to = canonical(1, toUnit);
  if (from.kind === "mass" && to.kind === "mass") {
    return to.grams === 0 ? 0 : from.grams / to.grams;
  }
  if (from.kind === "volume" && to.kind === "volume") {
    return to.ml === 0 ? 0 : from.ml / to.ml;
  }
  if (from.kind === "length" && to.kind === "length") {
    return to.inches === 0 ? 0 : from.inches / to.inches;
  }
  return amount;
}

export function formatDisplayedMeasure(
  amount: number,
  unit: string,
  prefs: MeasurePrefs,
  locale: Locale,
): string {
  const display = toDisplayMeasure(amount, unit, prefs);
  return `${formatAmount(display.amount)} ${formatUnit(display.unit, locale)}`;
}

const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

function parseMeasureNumber(raw: string): number | null {
  const text = raw.trim().replace(",", ".");
  if (FRACTIONS[text] != null) return FRACTIONS[text];
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const mixedUni = text.match(/^(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞])$/);
  if (mixedUni) return Number(mixedUni[1]) + FRACTIONS[mixedUni[2]];
  const frac = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function formatCm(inches: number): string {
  const cm = inches * 2.54;
  const nearest = Math.round(cm);
  if (Math.abs(cm - nearest) < 0.15) return String(nearest);
  return String(Math.round(cm * 10) / 10);
}

const NUMBER = String.raw`(?:\d+\s+)?(?:\d+\s*/\s*\d+|[½¼¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)`;

export function localizeInstruction(text: string, prefs: MeasurePrefs): string {
  if (prefs.length !== "ko") return text;

  let next = text.replace(/몇\s*인치/g, "몇 cm");
  next = next.replace(/a few inches/gi, "a few cm");
  next = next.replace(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*인치/gi,
    (_, a: string, b: string) => `${formatCm(Number(a.replace(",", ".")))}x${formatCm(Number(b.replace(",", ".")))}cm`,
  );
  next = next.replace(
    /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)[\s-]*inch(?:es)?/gi,
    (_, a: string, b: string) => `${formatCm(Number(a.replace(",", ".")))}x${formatCm(Number(b.replace(",", ".")))} cm`,
  );
  next = next.replace(new RegExp(`(${NUMBER})\\s*인치`, "g"), (match, raw: string) => {
    const value = parseMeasureNumber(raw);
    return value == null ? match : `${formatCm(value)}cm`;
  });
  next = next.replace(new RegExp(`(${NUMBER})[\\s-]*inch(?:es)?`, "gi"), (match, raw: string) => {
    const value = parseMeasureNumber(raw);
    return value == null ? match : `${formatCm(value)} cm`;
  });
  return next;
}
