import { repoRelativePosix } from "./filename.js";

const ALLOWED = new Set([
  // Keep in sync with tests/scripts/eslint-alchemy-plugin.test.ts, which pins
  // the allowed owner. Moving an allowed call site means updating both.
  // This is the stockpile-grant allowlist; the separate run-earned award-site
  // list lives in src/features/alchemy/run-loop/run/run-materials.ts
  // (AWARD_MATERIALS_CALL_SITES, enforced by the run-materials award guard).
  "src/features/alchemy/shared/stores/run-session-write-port.ts",
  "src/features/alchemy/shared/stores/write/run-homestead.ts",
  "src/features/alchemy/shared/stores/gear-session-command.ts",
  "src/features/alchemy/run-loop/run/run-materials.ts",
]);

function importedName(specifier) {
  const imported = specifier.imported;
  if (!imported) return "";
  if (imported.type === "Identifier") return imported.name;
  if (imported.type === "Literal" && typeof imported.value === "string") return imported.value;
  return "";
}

function isStockpileGrantCallee(node) {
  if (node.type === "Identifier") return node.name === "addMaterialsToStockpile";
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return node.property.name === "addMaterialsToStockpile";
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
export const noRunEarnedAddMaterials = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Run-earned materials must use awardMaterialsDuringRun(); progress addMaterialsToStockpile is limited to homestead-bonus and meta salvage.",
    },
    schema: [],
    messages: {
      addMaterials:
        "Use awardMaterialsDuringRun() for run-earned materials. addMaterialsToStockpile() is only for homestead end-of-run bonuses and meta salvage.",
    },
  },
  create(context) {
    const relative = repoRelativePosix(context.filename);
    if (ALLOWED.has(relative)) return {};
    const report = (node) => context.report({ node, messageId: "addMaterials" });
    return {
      ImportSpecifier(node) {
        if (importedName(node) === "addMaterialsToStockpile") report(node);
      },
      ExportSpecifier(node) {
        const exported = node.exported;
        const name =
          exported?.type === "Identifier"
            ? exported.name
            : exported?.type === "Literal" && typeof exported.value === "string"
              ? exported.value
              : "";
        if (name === "addMaterialsToStockpile") report(node);
      },
      CallExpression(node) {
        if (isStockpileGrantCallee(node.callee)) report(node.callee);
      },
    };
  },
};
