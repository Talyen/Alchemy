import { repoRelativePosix } from "./filename.js";

const ALLOWED = new Set([
  "src/features/alchemy/shared/stores/commands/run-session-write-port.ts",
  "src/features/alchemy/shared/stores/commands/write/run-homestead.ts",
  "src/features/alchemy/shared/stores/commands/gear-session-command.ts",
  "src/features/alchemy/shared/stores/commands/write/run-end.ts",
]);

function name(node) {
  return node?.type === "Identifier" ? node.name : node?.type === "Literal" ? node.value : undefined;
}

function memberName(node) {
  const property = node.property ?? node.key;
  if (node.computed && property.type === "Identifier") return undefined;
  if (property.type === "TemplateLiteral" && property.expressions.length === 0) return property.quasis[0].value.cooked;
  return name(property);
}

/** @type {Parameters<import("oxlint/plugins-dev").RuleTester["run"]>[1]} */
export const noRunEarnedAddMaterials = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Run-earned materials must use awardMaterialsDuringRun(); progress addMaterialsToStockpile is limited to homestead-bonus and meta salvage.",
    },
    schema: [],
    messages: {
      tally: "Run-earned material and currency tallies may only be mutated through the run-session write port.",
      addMaterials:
        "Use awardMaterialsDuringRun() for run-earned materials. addMaterialsToStockpile() is only for homestead end-of-run bonuses and meta salvage.",
    },
  },
  create(context) {
    const relative = repoRelativePosix(context.filename);
    const stockpileOwner = ALLOWED.has(relative);
    const tallyOwner =
      relative.startsWith("src/features/alchemy/shared/stores/commands/write/") ||
      relative === "src/features/alchemy/shared/stores/commands/run-session-write-port.ts";
    const report = (node) => context.report({ node, messageId: "addMaterials" });
    function checkTallyWrite(node) {
      if (tallyOwner) return;
      let target = node.type === "AssignmentExpression" ? node.left : node.argument;
      while (target?.type === "MemberExpression") {
        const field = memberName(target);
        if (field === "runMaterialsEarned" || field === "runCurrenciesEarned") {
          context.report({ node, messageId: "tally" });
          return;
        }
        target = target.object;
      }
    }
    return {
      AssignmentExpression: checkTallyWrite,
      UpdateExpression: checkTallyWrite,
      UnaryExpression(node) {
        if (node.operator === "delete") checkTallyWrite(node);
      },
      ImportSpecifier(node) {
        if (!stockpileOwner && name(node.imported) === "addMaterialsToStockpile") report(node);
      },
      ExportSpecifier(node) {
        if (!stockpileOwner && [name(node.local), name(node.exported)].includes("addMaterialsToStockpile"))
          report(node);
      },
      MemberExpression(node) {
        if (!stockpileOwner && memberName(node) === "addMaterialsToStockpile") report(node);
      },
      Property(node) {
        if (!stockpileOwner && node.parent.type === "ObjectPattern" && memberName(node) === "addMaterialsToStockpile")
          report(node);
      },
      CallExpression(node) {
        if (!stockpileOwner && node.callee.type === "Identifier" && node.callee.name === "addMaterialsToStockpile")
          report(node.callee);
      },
    };
  },
};
