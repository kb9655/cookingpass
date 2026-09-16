import type { Config } from "@netlify/functions";
export { default } from "../../api/suggest-substitutes";

export const config: Config = {
  path: "/api/suggest-substitutes",
  method: "POST",
};
