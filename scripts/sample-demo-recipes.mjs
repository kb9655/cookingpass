import fs from "node:fs";
import path from "node:path";

const sourcePath = path.resolve("resource_temp/1_Recipe_csv.csv");
const destPath = path.resolve("resource_temp/demo_recipes_20.csv");
const publicPath = path.resolve("public/datasets/demo_recipes_20.csv");
const SAMPLE_SIZE = 20;

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

function isValidRecipe(row, header) {
  const record = Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""]));
  if (!record.recipe_title?.trim()) return false;
  try {
    const ingredients = JSON.parse(record.ingredients);
    const directions = JSON.parse(record.directions);
    return Array.isArray(ingredients) && ingredients.length > 0 && Array.isArray(directions) && directions.length > 0;
  } catch {
    return false;
  }
}

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

const text = fs.readFileSync(sourcePath, "utf8");
const records = parseCsvRecords(text);
const [header, ...rows] = records;
if (!header?.includes("recipe_title")) {
  throw new Error("Expected recipe_title header in source CSV");
}

const valid = rows.filter((row) => isValidRecipe(row, header));
if (valid.length < SAMPLE_SIZE) {
  throw new Error(`Need ${SAMPLE_SIZE} valid recipes, found ${valid.length}`);
}

const sampled = shuffle(valid).slice(0, SAMPLE_SIZE);
const csv = toCsv([header, ...sampled]);
fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.mkdirSync(path.dirname(publicPath), { recursive: true });
fs.writeFileSync(destPath, csv);
fs.writeFileSync(publicPath, csv);

const titles = sampled.map((row) => row[header.indexOf("recipe_title")]);
console.log(`Wrote ${SAMPLE_SIZE} recipes to ${destPath}`);
console.log(titles.join("\n"));
