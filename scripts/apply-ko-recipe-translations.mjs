import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const enPath = join(root, "public", "datasets", "linked_recipes_50.csv");
const koPath = join(root, "resource_temp", "linked_recipes_50-ko.csv");
const outPath = join(root, "supabase", "migrations", "012_apply_ko_recipe_translations.sql");

const UNICODE_FRACTIONS = {
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
  "큰술",
  "작은술",
  "테이블스푼",
  "티스푼",
  "컵",
  "파운드",
  "온스",
  "쿼트",
  "쪽",
  "개",
  "줄기",
  "꼬집",
  "캔",
  "팩",
  "봉지",
  "패키지",
  "클로브",
];

function parseCsvRecords(text) {
  const records = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      if (row.some((cell) => cell !== "") || row.length > 1) records.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    records.push(row);
  }
  return records;
}

function parseJsonArray(raw) {
  const attempts = [raw ?? "[]", `${raw ?? ""}"]`];
  for (const candidate of attempts) {
    try {
      const value = JSON.parse(candidate);
      if (Array.isArray(value)) return value.map((item) => String(item));
    } catch {
      // try next
    }
  }
  throw new Error(`Could not parse JSON array: ${String(raw).slice(0, 80)}`);
}

function parseAmountToken(token) {
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

function parseIngredientLine(raw) {
  const decoded = raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  );
  const text = decoded.replace(/\s+/g, " ").trim();
  const tokens = text.split(" ");
  let consumed = 0;
  const first = parseAmountToken(tokens[0] ?? "");
  if (first !== null) {
    consumed = 1;
    const second = parseAmountToken(tokens[1] ?? "");
    if (second !== null && second < 1) consumed = 2;
  }
  const unitToken = (tokens[consumed] ?? "").toLowerCase().replace(/[.,]$/, "");
  if (UNITS.includes(unitToken)) consumed += 1;
  const name = tokens.slice(consumed).join(" ").replace(/,$/, "").trim() || text;
  return name;
}

function koreanIngredientName(raw) {
  let text = raw.replace(/\s+/g, " ").trim().replace(/,$/, "");
  text = text.replace(/^[\d¼½¾⅓⅔⅛⅜⅝⅞\s/.\-]+/, "");
  text = text.replace(/^\(\s*[\d.]+\s*[^)]*\)\s*/, "");
  const tokens = text.split(" ");
  const unitToken = (tokens[0] ?? "").replace(/[.,]$/, "");
  if (UNITS.includes(unitToken) || UNITS.includes(unitToken.toLowerCase())) {
    text = tokens.slice(1).join(" ");
  }
  text = text.replace(/\s*\d+(?:\s*\/\s*\d+)?\s*(?:개|컵|온스|파운드|큰술|작은술)(?=\s|,|$)/g, "");
  return text.replace(/^[,\s]+|[,\s]+$/g, "").trim() || raw.trim();
}

function parseRows(text) {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  const [header, ...rows] = records;
  const index = Object.fromEntries(header.map((key, i) => [key, i]));
  return rows.map((row, rowIndex) => {
    const title = (row[index.recipe_title] ?? "").trim();
    if (!title) throw new Error(`Empty title at row ${rowIndex + 2}`);
    return {
      title,
      category: row[index.category] ?? "",
      subcategory: row[index.subcategory] ?? "",
      description: row[index.description] ?? "",
      ingredients: parseJsonArray(row[index.ingredients]),
      directions: parseJsonArray(row[index.directions]),
    };
  });
}

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function values(rows) {
  return rows.join(",\n");
}

const enRows = parseRows(readFileSync(enPath, "utf8"));
const koRows = parseRows(readFileSync(koPath, "utf8"));
if (enRows.length !== koRows.length) {
  throw new Error(`Row count mismatch: EN ${enRows.length} vs KO ${koRows.length}`);
}

const recipes = [];
const steps = [];
const ingredientsByEn = new Map();
const warnings = [];

enRows.forEach((en, index) => {
  const ko = koRows[index];
  recipes.push({
    enName: en.title,
    name: ko.title,
    description: ko.description,
    category: ko.category,
    subcategory: ko.subcategory,
  });

  const stepCount = Math.min(en.directions.length, ko.directions.length);
  if (en.directions.length !== ko.directions.length) {
    warnings.push(
      `${en.title}: steps EN ${en.directions.length} vs KO ${ko.directions.length}`,
    );
  }
  for (let step = 0; step < stepCount; step += 1) {
    steps.push({
      enName: en.title,
      stepNumber: step + 1,
      instruction: ko.directions[step],
    });
  }

  const ingCount = Math.min(en.ingredients.length, ko.ingredients.length);
  if (en.ingredients.length !== ko.ingredients.length) {
    warnings.push(
      `${en.title}: ingredients EN ${en.ingredients.length} vs KO ${ko.ingredients.length}`,
    );
  }
  for (let i = 0; i < ingCount; i += 1) {
    const enName = parseIngredientLine(en.ingredients[i]);
    const koName = koreanIngredientName(ko.ingredients[i]);
    if (!enName || !koName) continue;
    if (!ingredientsByEn.has(enName)) ingredientsByEn.set(enName, koName);
  }
});

const ingredientPairs = [...ingredientsByEn.entries()];
const lines = [
  "-- Apply Korean translations from resource_temp/linked_recipes_50-ko.csv",
  `insert into public.recipe_translations (recipe_id, locale, name, description, category, subcategory)
select r.id, 'ko', v.name, v.description, v.category, v.subcategory
from (values
${values(
    recipes.map(
      (recipe) =>
        `(${sqlStr(recipe.enName)}, ${sqlStr(recipe.name)}, ${sqlStr(recipe.description)}, ${sqlStr(recipe.category)}, ${sqlStr(recipe.subcategory)})`,
    ),
  )}
) as v(en_name, name, description, category, subcategory)
join public.recipes r on r.name = v.en_name
on conflict (recipe_id, locale) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    subcategory = excluded.subcategory;`,
  `insert into public.recipe_step_translations (step_id, locale, instruction)
select s.id, 'ko', v.instruction
from (values
${values(
    steps.map(
      (step) =>
        `(${sqlStr(step.enName)}, ${step.stepNumber}, ${sqlStr(step.instruction)})`,
    ),
  )}
) as v(en_name, step_number, instruction)
join public.recipes r on r.name = v.en_name
join public.recipe_steps s on s.recipe_id = r.id and s.step_number = v.step_number
on conflict (step_id, locale) do update
set instruction = excluded.instruction;`,
  `insert into public.ingredient_translations (ingredient_id, locale, name)
select i.id, 'ko', v.name
from (values
${values(ingredientPairs.map(([enName, koName]) => `(${sqlStr(enName)}, ${sqlStr(koName)})`))}
) as v(en_name, name)
join public.ingredients i on i.name = v.en_name
on conflict (ingredient_id, locale) do update
set name = excluded.name;`,
];

writeFileSync(outPath, `${lines.join("\n\n")}\n`);
if (warnings.length) console.log(warnings.join("\n"));
console.log(
  `Wrote ${recipes.length} recipes, ${steps.length} steps, ${ingredientPairs.length} ingredients -> ${outPath}`,
);
