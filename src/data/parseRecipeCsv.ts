import type { RecipeIngredient } from "../types/ingredient";
import type { Recipe, RecipeStep } from "../types/recipe";
import { inferTechniqueIds } from "./localTechniques";

export type ParsedRecipeRecord = {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  technique_ids: string[];
};

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const UNITS = [
  "tablespoons",
  "tablespoon",
  "teaspoons",
  "teaspoon",
  "ounces",
  "ounce",
  "pounds",
  "pound",
  "cups",
  "cup",
  "cloves",
  "clove",
  "slices",
  "slice",
  "cans",
  "can",
  "packages",
  "package",
  "packets",
  "packet",
  "bunches",
  "bunch",
  "pinches",
  "pinch",
  "dashes",
  "dash",
  "quarts",
  "quart",
  "pints",
  "pint",
  "gallons",
  "gallon",
  "liters",
  "liter",
  "ml",
  "grams",
  "gram",
  "kg",
  "tbsp",
  "tsp",
  "oz",
  "lb",
  "g",
];

export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      if (row.some((cell) => cell !== "") || row.length > 1) records.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    records.push(row);
  }

  return records;
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

export function shortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).slice(0, 6);
}

export function ingredientIdFromName(name: string): string {
  return `ing-${slugify(name)}`;
}

function parseAmountToken(token: string): number | null {
  const cleaned = token.trim();
  if (!cleaned) return null;
  if (UNICODE_FRACTIONS[cleaned]) return UNICODE_FRACTIONS[cleaned];

  const mixed = cleaned.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/);
  if (mixed) return Number(mixed[1]) + UNICODE_FRACTIONS[mixed[2]];

  const fraction = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);

  const decimal = Number(cleaned.replace(",", "."));
  return Number.isFinite(decimal) ? decimal : null;
}

export function parseIngredientLine(raw: string): RecipeIngredient {
  const decoded = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  const text = decoded.replace(/\s+/g, " ").trim();
  const tokens = text.split(" ");
  let amount = 0;
  let consumed = 0;

  const first = parseAmountToken(tokens[0] ?? "");
  if (first !== null) {
    amount = first;
    consumed = 1;
    const second = parseAmountToken(tokens[1] ?? "");
    if (second !== null && second < 1) {
      amount += second;
      consumed = 2;
    }
  }

  let unit = "to taste";
  const unitToken = (tokens[consumed] ?? "").toLowerCase().replace(/[.,]$/, "");
  if (UNITS.includes(unitToken)) {
    unit = unitToken;
    consumed += 1;
  } else if (amount > 0) {
    unit = "count";
  }

  const name = tokens.slice(consumed).join(" ").replace(/,$/, "").trim() || text;
  return {
    ingredient_id: ingredientIdFromName(name),
    name,
    amount,
    unit,
    notes: null,
    category: "",
  };
}

function estimateMinutes(steps: string[]): number {
  const joined = steps.join(" ");
  const matches = [...joined.matchAll(/(\d+)\s*(?:to|-)\s*(\d+)\s*minutes?|\b(\d+)\s*minutes?/gi)];
  let total = 0;
  for (const match of matches) {
    if (match[1] && match[2]) total += Math.round((Number(match[1]) + Number(match[2])) / 2);
    else if (match[3]) total += Number(match[3]);
  }
  if (total > 0) return Math.min(180, total);
  return Math.max(10, Math.min(60, steps.length * 6));
}

function inferTools(text: string): string[] {
  const haystack = text.toLowerCase();
  const tools: Array<[string, string[]]> = [
    ["에어프라이어", ["air fryer"]],
    ["오븐", ["oven", "bake"]],
    ["냄비", ["saucepan", "pot", "boil"]],
    ["프라이팬", ["skillet", "frying pan", "saute", "sauté"]],
    ["그릴", ["grill"]],
    ["칼", ["slice", "chop", "dice", "mince", "knife"]],
    ["믹서", ["mixer", "blend"]],
  ];
  return tools.filter(([, keys]) => keys.some((key) => haystack.includes(key))).map(([name]) => name);
}

export function parseTitleCategoryJsonArrays(
  csvText: string,
  datasetId: string,
): ParsedRecipeRecord[] {
  const records = parseCsvRecords(csvText);
  const [header, ...rows] = records;
  if (!header) return [];

  const index = Object.fromEntries(header.map((key, i) => [key, i]));
  const recipes: ParsedRecipeRecord[] = [];

  for (const row of rows) {
    const title = row[index.recipe_title] ?? "";
    if (!title.trim()) continue;

    let ingredientLines: string[] = [];
    let directionLines: string[] = [];
    try {
      ingredientLines = JSON.parse(row[index.ingredients] ?? "[]") as string[];
      directionLines = JSON.parse(row[index.directions] ?? "[]") as string[];
    } catch {
      continue;
    }
    if (!Array.isArray(ingredientLines) || !Array.isArray(directionLines)) continue;
    if (ingredientLines.length === 0 || directionLines.length === 0) continue;

    const description = row[index.description] ?? "";
    const category = row[index.category] ?? "";
    const subcategory = row[index.subcategory] ?? "";
    const id = `${slugify(title)}-${shortHash(`${datasetId}:${title}:${ingredientLines.join("|")}`)}`;
    const ingredients = ingredientLines.map(parseIngredientLine);
    const steps: RecipeStep[] = directionLines.map((instruction, stepIndex) => ({
      id: `${id}-step-${stepIndex + 1}`,
      recipe_id: id,
      step_number: stepIndex + 1,
      instruction,
      technique_id: null,
    }));
    const blob = `${title}\n${description}\n${directionLines.join("\n")}`;
    const techniqueIds = inferTechniqueIds(blob);
    const tools = inferTools(blob);

    recipes.push({
      recipe: {
        id,
        slug: id,
        name: title,
        description,
        difficulty: Math.min(5, Math.max(1, Math.ceil(ingredientLines.length / 4))),
        estimated_minutes: estimateMinutes(directionLines),
        servings: 2,
        required_tools: tools,
        category,
        subcategory,
        source_dataset: datasetId,
      },
      ingredients,
      steps,
      technique_ids: techniqueIds,
    });
  }

  return recipes;
}
