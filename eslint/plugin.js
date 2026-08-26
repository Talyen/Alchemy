import { noDependencyGraphComments } from "./no-dependency-graph-comments.js";
import { noLibFetch } from "./no-lib-fetch.js";
import { noRenderMathRandom } from "./no-render-math-random.js";
import { noRunEarnedAddMaterials } from "./no-run-earned-add-materials.js";
import { noUnownedWebStorage } from "./no-unowned-web-storage.js";

/** @type {import("eslint").ESLint.Plugin} */
export const alchemyPlugin = {
  rules: {
    "no-dependency-graph-comments": noDependencyGraphComments,
    "no-lib-fetch": noLibFetch,
    "no-render-math-random": noRenderMathRandom,
    "no-run-earned-add-materials": noRunEarnedAddMaterials,
    "no-unowned-web-storage": noUnownedWebStorage,
  },
};
