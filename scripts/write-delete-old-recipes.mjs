import { readFileSync, writeFileSync } from "node:fs";

const recipesSql = readFileSync("scripts/.seed-chunks/05.sql", "utf8");
const ids = [...recipesSql.matchAll(/\('([0-9a-f-]{36})',/g)].map((match) => match[1]);
if (ids.length !== 50) {
  throw new Error(`Expected 50 recipe ids, got ${ids.length}`);
}

writeFileSync(
  "scripts/.seed-chunks/11-delete-old.sql",
  [
    "delete from public.cooking_history;",
    `delete from public.recipes where id not in (${ids.map((id) => `'${id}'`).join(", ")});`,
    "",
  ].join("\n"),
);
console.log(`Wrote delete for ${ids.length} kept recipes`);
