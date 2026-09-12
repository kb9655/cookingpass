import fs from "node:fs";
import path from "node:path";

const SAMPLE_SIZE = 50;
const MAX_PER_CATEGORY = 6;
const destPath = path.resolve("resource_temp/linked_recipes_50.csv");
const publicPath = path.resolve("public/datasets/linked_recipes_50.csv");

const TECHNIQUES = [
  { slug: "knife-grip", keywords: ["knife", "chop", "dice", "cut"] },
  { slug: "peel-fruit", keywords: ["peel", "peeled", "shuck"] },
  { slug: "julienne", keywords: ["julienne", "thin strip", "shred"] },
  { slug: "mince", keywords: ["mince", "minced", "finely chop"] },
  { slug: "slice", keywords: ["slice", "sliced", "cut into"] },
  { slug: "preheat-pan", keywords: ["preheat", "heat a skillet", "heat a pan", "hot pan"] },
  { slug: "stir-fry", keywords: ["stir-fry", "stir fry", "saute", "sauté", "fry"] },
  { slug: "boil", keywords: ["boil", "simmer", "bring to a boil", "boiling water"] },
  { slug: "season-toss", keywords: ["toss", "tossed", "coat", "mix until", "season with"] },
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

function toCsv(rows) {
  return (
    rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
            return value;
          })
          .join(","),
      )
      .join("\n") + "\n"
  );
}

function inferSlugs(text) {
  const haystack = text.toLowerCase();
  return TECHNIQUES.filter((technique) =>
    technique.keywords.some((keyword) => haystack.includes(keyword)),
  ).map((technique) => technique.slug);
}

function findSourcePath() {
  const candidates = [
    path.resolve("1_Recipe_csv.csv"),
    path.resolve("resource_temp/1_Recipe_csv.csv"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

const sourcePath = findSourcePath();
if (!sourcePath) {
  throw new Error("1_Recipe_csv.csv not found in repo root or resource_temp/");
}

const text = fs.readFileSync(sourcePath, "utf8");
const records = parseCsvRecords(text);
const [header, ...rows] = records;
if (!header?.includes("recipe_title")) {
  throw new Error("Expected recipe_title header in source CSV");
}

const index = Object.fromEntries(header.map((key, i) => [key, i]));
const seenTitles = new Set();
const scored = [];

for (const row of rows) {
  const title = (row[index.recipe_title] ?? "").trim();
  if (!title || seenTitles.has(title.toLowerCase())) continue;

  let ingredients;
  let directions;
  try {
    ingredients = JSON.parse(row[index.ingredients] ?? "[]");
    directions = JSON.parse(row[index.directions] ?? "[]");
  } catch {
    continue;
  }
  if (!Array.isArray(ingredients) || ingredients.length === 0) continue;
  if (!Array.isArray(directions) || directions.length === 0) continue;

  const description = row[index.description] ?? "";
  const category = row[index.category] ?? "";
  const blob = `${title}\n${description}\n${directions.join("\n")}`;
  const slugs = inferSlugs(blob);
  if (slugs.length === 0) continue;

  const ingredientCount = ingredients.length;
  const stepCount = directions.length;
  const haystack = blob.toLowerCase();
  const specialtyOnly =
    /air fryer|instant pot|slow cooker|pressure cooker/.test(haystack) &&
    !/skillet|saucepan|pot\b|knife|chop|slice|saute|sauté|stir-fry|boil|simmer/.test(haystack);

  let score = slugs.length * 100;
  if (slugs.length >= 2) score += 200;
  if (ingredientCount >= 4 && ingredientCount <= 14) score += 20;
  if (stepCount >= 3 && stepCount <= 12) score += 20;
  if (specialtyOnly) score -= 80;

  seenTitles.add(title.toLowerCase());
  scored.push({ row, title, category, slugs, score, ingredientCount, stepCount });
}

scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

const picked = [];
const categoryCounts = new Map();
const leftover = [];

for (const item of scored) {
  const used = categoryCounts.get(item.category) ?? 0;
  if (used >= MAX_PER_CATEGORY) {
    leftover.push(item);
    continue;
  }
  picked.push(item);
  categoryCounts.set(item.category, used + 1);
  if (picked.length >= SAMPLE_SIZE) break;
}

for (const item of leftover) {
  if (picked.length >= SAMPLE_SIZE) break;
  picked.push(item);
}

if (picked.length < SAMPLE_SIZE) {
  throw new Error(`Need ${SAMPLE_SIZE} linked recipes, found ${picked.length}`);
}

const selected = picked.slice(0, SAMPLE_SIZE);
const csv = toCsv([header, ...selected.map((item) => item.row)]);
fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.mkdirSync(path.dirname(publicPath), { recursive: true });
fs.writeFileSync(destPath, csv);
fs.writeFileSync(publicPath, csv);

console.log(`Source: ${sourcePath}`);
console.log(`Wrote ${selected.length} recipes to ${destPath}`);
console.log(`Also wrote ${publicPath}`);
console.log("");
for (const item of selected) {
  console.log(`${item.title} | ${item.category} | ${item.slugs.join(", ")}`);
}
