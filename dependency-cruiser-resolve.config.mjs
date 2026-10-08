import { fileURLToPath, URL } from "node:url";
import { VITE_ALIAS_PATH, VITE_ALIAS_TARGET } from "./scripts/lib/vite-aliases.mjs";

// Dependency-cruiser's public resolve-config seam works without the TS compiler API.
export default {
  resolve: { alias: { [VITE_ALIAS_PATH]: fileURLToPath(new URL(VITE_ALIAS_TARGET, import.meta.url)) } },
};
