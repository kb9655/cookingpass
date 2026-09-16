import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const enPath = join(root, "resource_temp", "demo_recipes_20.csv");
const koPath = join(root, "resource_temp", "demo_recipes_20-ko.csv");
const outPath = join(root, "supabase", "migrations", "005_seed_demo_recipes.sql");

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
];

const TECHNIQUES = [
  { id: "a1111111-1111-4111-8111-111111111101", keywords: ["knife", "chop", "dice", "cut"] },
  { id: "a1111111-1111-4111-8111-111111111102", keywords: ["peel", "peeled", "shuck"] },
  { id: "a1111111-1111-4111-8111-111111111103", keywords: ["julienne", "thin strip", "shred"] },
  { id: "a1111111-1111-4111-8111-111111111104", keywords: ["mince", "minced", "finely chop"] },
  { id: "a1111111-1111-4111-8111-111111111105", keywords: ["slice", "sliced", "cut into"] },
  { id: "a1111111-1111-4111-8111-111111111106", keywords: ["parboil", "blanch", "hard-boiled", "boil until", "boiling water"] },
  { id: "a1111111-1111-4111-8111-111111111107", keywords: ["stir-fry", "stir fry", "saute", "sauté", "fry"] },
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

function parseRows(text) {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  const [header, ...rows] = records;
  const index = Object.fromEntries(header.map((key, i) => [key, i]));
  return rows
    .map((row) => {
      const title = row[index.recipe_title] ?? "";
      if (!title.trim()) return null;
      let ingredients;
      let directions;
      try {
        ingredients = JSON.parse(row[index.ingredients] ?? "[]");
        directions = JSON.parse(row[index.directions] ?? "[]");
      } catch {
        return null;
      }
      if (!Array.isArray(ingredients) || !Array.isArray(directions)) return null;
      if (!ingredients.length || !directions.length) return null;
      return {
        title,
        category: row[index.category] ?? "",
        subcategory: row[index.subcategory] ?? "",
        description: row[index.description] ?? "",
        ingredients,
        directions,
      };
    })
    .filter(Boolean);
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
  return { name, amount, unit, raw: text };
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "item";
}

function uuidFrom(seed) {
  const hex = createHash("sha1").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function estimateMinutes(steps) {
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

function inferTools(text) {
  const haystack = text.toLowerCase();
  const tools = [
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

function inferTechniqueIds(text) {
  const haystack = text.toLowerCase();
  return TECHNIQUES.filter((technique) =>
    technique.keywords.some((keyword) => haystack.includes(keyword)),
  ).map((technique) => technique.id);
}

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArr(values) {
  if (!values.length) return `'{}'::text[]`;
  return `ARRAY[${values.map(sqlStr).join(", ")}]::text[]`;
}

function sqlNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "0";
}

const enRows = parseRows(readFileSync(enPath, "utf8"));
const koRows = parseRows(readFileSync(koPath, "utf8"));
if (enRows.length !== koRows.length) {
  throw new Error(`Row count mismatch: en=${enRows.length} ko=${koRows.length}`);
}

const recipes = [];
const ingredientsByKey = new Map();
const recipeIngredients = [];
const steps = [];
const recipeTechniques = [];

for (let i = 0; i < enRows.length; i += 1) {
  const en = enRows[i];
  const ko = koRows[i];
  const slug = `${slugify(en.title)}-${createHash("sha1").update(en.title).digest("hex").slice(0, 6)}`;
  const recipeId = uuidFrom(`recipe:${slug}`);
  const blob = `${en.title}\n${en.description}\n${en.directions.join("\n")}`;
  const tools = inferTools(blob);
  const techniqueIds = inferTechniqueIds(blob);
  const difficulty = Math.min(5, Math.max(1, Math.ceil(en.ingredients.length / 4)));
  const minutes = estimateMinutes(en.directions);

  recipes.push({
    id: recipeId,
    slug,
    name: en.title,
    description: en.description,
    category: en.category,
    subcategory: en.subcategory,
    difficulty,
    minutes,
    tools,
    en,
    ko,
  });

  const usedIngredientIds = new Set();
  const count = Math.max(en.ingredients.length, ko.ingredients.length);
  for (let j = 0; j < count; j += 1) {
    const parsed = parseIngredientLine(en.ingredients[j] ?? ko.ingredients[j] ?? "");
    const key = parsed.name.toLowerCase();
    let ingredient = ingredientsByKey.get(key);
    if (!ingredient) {
      ingredient = {
        id: uuidFrom(`ingredient:${key}`),
        name: parsed.name,
        defaultUnit: parsed.unit,
        category: en.category || "other",
        nameEn: parsed.name,
        nameKo: (ko.ingredients[j] ?? parsed.name).replace(/\s+/g, " ").trim(),
      };
      ingredientsByKey.set(key, ingredient);
    } else if (ko.ingredients[j] && ingredient.nameKo === ingredient.nameEn) {
      ingredient.nameKo = ko.ingredients[j].replace(/\s+/g, " ").trim();
    }
    if (usedIngredientIds.has(ingredient.id)) continue;
    usedIngredientIds.add(ingredient.id);
    recipeIngredients.push({
      recipeId,
      ingredientId: ingredient.id,
      amount: parsed.amount,
      unit: parsed.unit,
    });
  }

  const stepCount = Math.max(en.directions.length, ko.directions.length);
  for (let j = 0; j < stepCount; j += 1) {
    steps.push({
      id: uuidFrom(`step:${slug}:${j + 1}`),
      recipeId,
      stepNumber: j + 1,
      instructionEn: en.directions[j] ?? ko.directions[j] ?? "",
      instructionKo: ko.directions[j] ?? en.directions[j] ?? "",
    });
  }

  techniqueIds.forEach((techniqueId, index) => {
    recipeTechniques.push({
      recipeId,
      techniqueId,
      isPrimary: index === 0,
    });
  });
}

function values(rows) {
  return rows.join(",\n");
}

const slugs = recipes.map((recipe) => sqlStr(recipe.slug)).join(", ");
const ingredientList = [...ingredientsByKey.values()];
const lines = [
  "-- Seed bilingual demo recipes from resource_temp CSV pair.",
  `delete from public.recipes where slug in (${slugs});`,
  `insert into public.ingredients (id, name, default_unit, category) values\n${values(
    ingredientList.map(
      (ingredient) =>
        `(${sqlStr(ingredient.id)}, ${sqlStr(ingredient.name)}, ${sqlStr(ingredient.defaultUnit)}, ${sqlStr(ingredient.category)})`,
    ),
  )}\non conflict (id) do update set name = excluded.name, default_unit = excluded.default_unit, category = excluded.category;`,
  `insert into public.ingredient_translations (ingredient_id, locale, name) values\n${values(
    ingredientList.flatMap((ingredient) => [
      `(${sqlStr(ingredient.id)}, 'en', ${sqlStr(ingredient.nameEn)})`,
      `(${sqlStr(ingredient.id)}, 'ko', ${sqlStr(ingredient.nameKo)})`,
    ]),
  )}\non conflict (ingredient_id, locale) do update set name = excluded.name;`,
  `insert into public.recipes (id, slug, name, description, difficulty, estimated_minutes, servings, required_tools, category, subcategory) values\n${values(
    recipes.map(
      (recipe) =>
        `(${sqlStr(recipe.id)}, ${sqlStr(recipe.slug)}, ${sqlStr(recipe.name)}, ${sqlStr(recipe.description)}, ${recipe.difficulty}, ${recipe.minutes}, 2, ${sqlArr(recipe.tools)}, ${sqlStr(recipe.category)}, ${sqlStr(recipe.subcategory)})`,
    ),
  )};`,
  `insert into public.recipe_translations (recipe_id, locale, name, description, category, subcategory) values\n${values(
    recipes.flatMap((recipe) => [
      `(${sqlStr(recipe.id)}, 'en', ${sqlStr(recipe.en.title)}, ${sqlStr(recipe.en.description)}, ${sqlStr(recipe.en.category)}, ${sqlStr(recipe.en.subcategory)})`,
      `(${sqlStr(recipe.id)}, 'ko', ${sqlStr(recipe.ko.title)}, ${sqlStr(recipe.ko.description)}, ${sqlStr(recipe.ko.category)}, ${sqlStr(recipe.ko.subcategory)})`,
    ]),
  )};`,
  `insert into public.recipe_steps (id, recipe_id, step_number, instruction) values\n${values(
    steps.map(
      (step) =>
        `(${sqlStr(step.id)}, ${sqlStr(step.recipeId)}, ${step.stepNumber}, ${sqlStr(step.instructionEn)})`,
    ),
  )};`,
  `insert into public.recipe_step_translations (step_id, locale, instruction) values\n${values(
    steps.flatMap((step) => [
      `(${sqlStr(step.id)}, 'en', ${sqlStr(step.instructionEn)})`,
      `(${sqlStr(step.id)}, 'ko', ${sqlStr(step.instructionKo)})`,
    ]),
  )};`,
  `insert into public.recipe_ingredients (recipe_id, ingredient_id, amount, unit) values\n${values(
    recipeIngredients.map(
      (item) =>
        `(${sqlStr(item.recipeId)}, ${sqlStr(item.ingredientId)}, ${sqlNum(item.amount)}, ${sqlStr(item.unit)})`,
    ),
  )}\non conflict (recipe_id, ingredient_id) do update set amount = excluded.amount, unit = excluded.unit;`,
  `insert into public.recipe_techniques (recipe_id, technique_id, is_primary) values\n${values(
    recipeTechniques.map(
      (item) => `(${sqlStr(item.recipeId)}, ${sqlStr(item.techniqueId)}, ${item.isPrimary})`,
    ),
  )}\non conflict (recipe_id, technique_id) do update set is_primary = excluded.is_primary;`,
];
writeFileSync(outPath, `${lines.join("\n\n")}\n`);
console.log(`Wrote ${recipes.length} recipes, ${ingredientsByKey.size} ingredients, ${steps.length} steps -> ${outPath}`);
