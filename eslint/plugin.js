import { noComments } from "./no-comments.js";
import { noEmDash } from "./no-em-dash.js";
import { noLibFetch } from "./no-lib-fetch.js";
import { noRunEarnedAddMaterials } from "./no-run-earned-add-materials.js";
import { noUnownedWebStorage } from "./no-unowned-web-storage.js";

/** @type {import("eslint").ESLint.Plugin} */
export const alchemyPlugin = {
  rules: {
    "no-comments": noComments,
    "no-em-dash": noEmDash,
    "no-lib-fetch": noLibFetch,
    "no-run-earned-add-materials": noRunEarnedAddMaterials,
    "no-unowned-web-storage": noUnownedWebStorage,
  },
};
