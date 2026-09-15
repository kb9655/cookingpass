import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const src = "supabase/migrations/012_apply_ko_recipe_translations.sql";
const outDir = "scripts/.seed-chunks/ko-batches";
mkdirSync(outDir, { recursive: true });

const MAX_CHARS = 12000;

function splitValuesInsert(sql, prefix) {
  const footerMatch = sql.match(/\n\) as v[\s\S]*$/i) || sql.match(/\non conflict[\s\S]*$/i);
  const footer = footerMatch ? footerMatch[0] : ";";
  const withoutFooter = footerMatch ? sql.slice(0, footerMatch.index) : sql.replace(/;\s*$/, "");
  const headerMatch = withoutFooter.match(/^([\s\S]*?\bvalues)\s*/i);
  if (!headerMatch) {
    writeFileSync(join(outDir, `${prefix}-01.sql`), `${sql.trim()}\n`);
    return [`${prefix}-01.sql`];
  }

  const header = headerMatch[1];
  const valuesBlob = withoutFooter.slice(headerMatch[0].length).trim();
  const rows = [];
  let current = "";
  let depth = 0;
  for (const char of valuesBlob) {
    current += char;
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0 && char === ",") {
      rows.push(current.slice(0, -1).trim());
      current = "";
    }
  }
  if (current.trim()) rows.push(current.trim());

  const files = [];
  let batch = [];
  let batchChars = 0;
  let index = 1;
  const flush = () => {
    if (!batch.length) return;
    const name = `${prefix}-${String(index).padStart(2, "0")}.sql`;
    writeFileSync(
      join(outDir, name),
      `${header}\n${batch.join(",\n")}${footer.startsWith("\n") ? footer : `\n${footer}`}\n`,
    );
    files.push(name);
    index += 1;
    batch = [];
    batchChars = 0;
  };

  for (const row of rows) {
    const extra = row.length + 2;
    if (batch.length && batchChars + extra > MAX_CHARS) flush();
    batch.push(row);
    batchChars += extra;
  }
  flush();
  return files;
}

const parts = readFileSync(src, "utf8")
  .split(/\n\n+/)
  .filter((part) => /insert into/i.test(part));
const labels = ["01-recipes", "02-steps", "03-ingredients"];
const manifest = [];
parts.forEach((part, i) => {
  manifest.push(...splitValuesInsert(part.trim(), labels[i] ?? `0${i + 1}`));
});
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(manifest.join("\n"));
console.log(`batches: ${manifest.length}`);
