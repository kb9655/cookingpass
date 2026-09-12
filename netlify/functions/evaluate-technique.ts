import type { Config } from "@netlify/functions";
export { default } from "../../api/evaluate-technique";

export const config: Config = {
  path: "/api/evaluate-technique",
  method: "POST",
};
