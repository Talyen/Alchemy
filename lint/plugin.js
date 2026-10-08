import { sessionOwnership } from "./session-ownership.js";
import { requireDisableReason } from "./require-disable-reason.js";
import { noEmDash } from "./no-em-dash.js";
import { noLibFetch } from "./no-lib-fetch.js";
import { noRunEarnedAddMaterials } from "./no-run-earned-add-materials.js";
import { noUnownedWebStorage } from "./no-unowned-web-storage.js";
import { restrictedSyntax } from "./restricted-syntax.js";
import { battleTypesOnly } from "./battle-types-only.js";

/** @type {{meta: {name: string}, rules: Record<string, Parameters<import("oxlint/plugins-dev").RuleTester["run"]>[1]>}} */
export const alchemyPlugin = {
  meta: { name: "alchemy" },
  rules: {
    "session-ownership": sessionOwnership,
    "require-disable-reason": requireDisableReason,
    "no-em-dash": noEmDash,
    "no-lib-fetch": noLibFetch,
    "no-run-earned-add-materials": noRunEarnedAddMaterials,
    "no-unowned-web-storage": noUnownedWebStorage,
    "restricted-syntax": restrictedSyntax,
    "battle-types-only": battleTypesOnly,
  },
};

export default alchemyPlugin;
