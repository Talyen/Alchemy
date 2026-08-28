import { repoRelativePosix } from "./filename.js";

const ALLOWED = new Set([
  "src/features/alchemy/shared/stores/homestead-actions.ts",
  "src/features/alchemy/shared/stores/write-port-profile.ts",
  "src/features/alchemy/shared/stores/write-port-session.ts",
  "src/features/alchemy/shared/stores/run-session-write-port.ts",
  "src/features/alchemy/shared/stores/gear-session-command.ts",
  "src/features/alchemy/run-loop/run/run-flow-session-helpers.ts",
]);

function importedName(specifier) {
  const imported = specifier.imported;
  if (!imported) return "";
  if (imported.type === "Identifier") return imported.name;
  if (imported.type === "Literal" && typeof imported.value === "string") return imported.value;
  return "";
}

function isAddMaterialsCallee(node) {
  if (node.type === "Identifier") return node.name === "addMaterials";
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return node.property.name === "addMaterials";
  }
  return false;
}

/** @type {import("eslint").Rule.RuleModule} */
export const noRunEarnedAddMaterials = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Run-earned materials must use awardMaterialsDuringRun(); progress addMaterials is limited to homestead-bonus and meta salvage.",
    },
    schema: [],
    messages: {
      addMaterials:
        "Use awardMaterialsDuringRun() for run-earned materials. addMaterials() is only for homestead end-of-run bonuses and meta salvage.",
    },
  },
  create(context) {
    const relative = repoRelativePosix(context.filename);
    if (ALLOWED.has(relative)) return {};
    const report = (node) => context.report({ node, messageId: "addMaterials" });
    return {
      ImportSpecifier(node) {
        if (importedName(node) === "addMaterials") report(node);
      },
      ExportSpecifier(node) {
        const exported = node.exported;
        const name =
          exported?.type === "Identifier"
            ? exported.name
            : exported?.type === "Literal" && typeof exported.value === "string"
              ? exported.value
              : "";
        if (name === "addMaterials") report(node);
      },
      CallExpression(node) {
        if (isAddMaterialsCallee(node.callee)) report(node.callee);
      },
    };
  },
};
