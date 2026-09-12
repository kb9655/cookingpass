import type { Config } from "@netlify/functions";
export { default } from "../../api/generate-recipe";

export const config: Config = {
  path: "/api/generate-recipe",
  method: "POST",
};
