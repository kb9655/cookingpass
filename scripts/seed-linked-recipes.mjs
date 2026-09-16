import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = join(root, "public", "datasets", "linked_recipes_50.csv");
const outPath = join(root, "supabase", "migrations", "011_replace_recipes_with_linked_50.sql");

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
  { id: "a1111111-1111-4111-8111-111111111108", keywords: ["boil", "simmer", "bring to a boil", "boiling water"] },
  { id: "a1111111-1111-4111-8111-111111111109", keywords: ["toss", "tossed", "coat", "mix until", "season with"] },
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
  return { name, amount, unit };
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

function values(rows) {
  return rows.join(",\n");
}

const sourceRows = parseRows(readFileSync(csvPath, "utf8"));
if (sourceRows.length === 0) {
  throw new Error(`No recipes parsed from ${csvPath}`);
}

const recipes = [];
const ingredientsByKey = new Map();
const recipeIngredients = [];
const steps = [];
const recipeTechniques = [];

for (const row of sourceRows) {
  const slug = `${slugify(row.title)}-${createHash("sha1").update(row.title).digest("hex").slice(0, 6)}`;
  const recipeId = uuidFrom(`linked-recipe:${slug}`);
  const blob = `${row.title}\n${row.description}\n${row.directions.join("\n")}`;
  const tools = inferTools(blob);
  const techniqueIds = inferTechniqueIds(blob);
  const difficulty = Math.min(5, Math.max(1, Math.ceil(row.ingredients.length / 4)));
  const minutes = estimateMinutes(row.directions);

  recipes.push({
    id: recipeId,
    slug,
    name: row.title,
    description: row.description,
    category: row.category,
    subcategory: row.subcategory,
    difficulty,
    minutes,
    tools,
  });

  const usedIngredientIds = new Set();
  for (const line of row.ingredients) {
    const parsed = parseIngredientLine(line);
    const key = parsed.name.toLowerCase();
    let ingredient = ingredientsByKey.get(key);
    if (!ingredient) {
      ingredient = {
        id: uuidFrom(`linked-ingredient:${key}`),
        name: parsed.name,
        defaultUnit: parsed.unit,
        category: row.category || "other",
      };
      ingredientsByKey.set(key, ingredient);
    }
    if (usedIngredientIds.has(ingredient.id)) continue;
    usedIngredientIds.add(ingredient.id);
    recipeIngredients.push({
      recipeId,
      ingredientName: ingredient.name,
      amount: parsed.amount,
      unit: parsed.unit,
    });
  }

  row.directions.forEach((instruction, index) => {
    steps.push({
      id: uuidFrom(`linked-step:${slug}:${index + 1}`),
      recipeId,
      stepNumber: index + 1,
      instruction,
    });
  });

  techniqueIds.forEach((techniqueId, index) => {
    recipeTechniques.push({
      recipeId,
      techniqueId,
      isPrimary: index === 0,
    });
  });
}

const ingredientList = [...ingredientsByKey.values()];
const lines = [
  "-- Replace catalog recipes with the 50 linked-technique CSV rows.",
  "delete from public.cooking_history;",
  "delete from public.recipes;",
  `insert into public.ingredients (id, name, default_unit, category) values\n${values(
    ingredientList.map(
      (ingredient) =>
        `(${sqlStr(ingredient.id)}, ${sqlStr(ingredient.name)}, ${sqlStr(ingredient.defaultUnit)}, ${sqlStr(ingredient.category)})`,
    ),
  )}\non conflict (name) do update set default_unit = excluded.default_unit, category = excluded.category;`,
  `insert into public.ingredient_translations (ingredient_id, locale, name)\nselect i.id, v.locale, v.name\nfrom (values\n${values(
    ingredientList.flatMap((ingredient) => [
      `(${sqlStr(ingredient.name)}, 'en', ${sqlStr(ingredient.name)})`,
      `(${sqlStr(ingredient.name)}, 'ko', ${sqlStr(ingredient.name)})`,
    ]),
  )}\n) as v(ingredient_name, locale, name)\njoin public.ingredients i on i.name = v.ingredient_name\non conflict (ingredient_id, locale) do update set name = excluded.name;`,
  `insert into public.recipes (id, slug, name, description, difficulty, estimated_minutes, servings, required_tools, category, subcategory) values\n${values(
    recipes.map(
      (recipe) =>
        `(${sqlStr(recipe.id)}, ${sqlStr(recipe.slug)}, ${sqlStr(recipe.name)}, ${sqlStr(recipe.description)}, ${recipe.difficulty}, ${recipe.minutes}, 2, ${sqlArr(recipe.tools)}, ${sqlStr(recipe.category)}, ${sqlStr(recipe.subcategory)})`,
    ),
  )};`,
  `insert into public.recipe_translations (recipe_id, locale, name, description, category, subcategory) values\n${values(
    recipes.flatMap((recipe) => [
      `(${sqlStr(recipe.id)}, 'en', ${sqlStr(recipe.name)}, ${sqlStr(recipe.description)}, ${sqlStr(recipe.category)}, ${sqlStr(recipe.subcategory)})`,
      `(${sqlStr(recipe.id)}, 'ko', ${sqlStr(recipe.name)}, ${sqlStr(recipe.description)}, ${sqlStr(recipe.category)}, ${sqlStr(recipe.subcategory)})`,
    ]),
  )};`,
  `insert into public.recipe_steps (id, recipe_id, step_number, instruction) values\n${values(
    steps.map(
      (step) =>
        `(${sqlStr(step.id)}, ${sqlStr(step.recipeId)}, ${step.stepNumber}, ${sqlStr(step.instruction)})`,
    ),
  )};`,
  `insert into public.recipe_step_translations (step_id, locale, instruction) values\n${values(
    steps.flatMap((step) => [
      `(${sqlStr(step.id)}, 'en', ${sqlStr(step.instruction)})`,
      `(${sqlStr(step.id)}, 'ko', ${sqlStr(step.instruction)})`,
    ]),
  )};`,
  `insert into public.recipe_ingredients (recipe_id, ingredient_id, amount, unit)\nselect v.recipe_id::uuid, i.id, v.amount, v.unit\nfrom (values\n${values(
    recipeIngredients.map(
      (item) =>
        `(${sqlStr(item.recipeId)}, ${sqlStr(item.ingredientName)}, ${sqlNum(item.amount)}, ${sqlStr(item.unit)})`,
    ),
  )}\n) as v(recipe_id, ingredient_name, amount, unit)\njoin public.ingredients i on i.name = v.ingredient_name\non conflict (recipe_id, ingredient_id) do update set amount = excluded.amount, unit = excluded.unit;`,
  `insert into public.recipe_techniques (recipe_id, technique_id, is_primary) values\n${values(
    recipeTechniques.map(
      (item) => `(${sqlStr(item.recipeId)}, ${sqlStr(item.techniqueId)}, ${item.isPrimary})`,
    ),
  )}\non conflict (recipe_id, technique_id) do update set is_primary = excluded.is_primary;`,
];

writeFileSync(outPath, `${lines.join("\n\n")}\n`);
console.log(
  `Wrote ${recipes.length} recipes, ${ingredientList.length} ingredients, ${steps.length} steps -> ${outPath}`,
);
