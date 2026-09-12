import type { Config } from "@netlify/functions";
export { default } from "../../api/media-url";

export const config: Config = {
  path: "/api/media-url",
  method: "POST",
};
