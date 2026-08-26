const LAZY_HOOKS = new Set(["useState", "useCallback", "useMemo"]);

function calleeName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    return node.property.name;
  }
  return "";
}

function isMathRandomCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "Math" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "random"
  );
}

/** @type {import("eslint").Rule.RuleModule} */
export const noRenderMathRandom = {
  meta: {
    type: "problem",
    docs: {
      description: "Cosmetic Math.random() must initialize lazily via useState/useCallback/useMemo, not during render.",
    },
    schema: [],
    messages: {
      renderRandom:
        "Do not call Math.random() during render. Initialize lazily with useState(() => …) or keep it inside useCallback/useMemo.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isMathRandomCall(node)) return;
        const ancestors = context.sourceCode.getAncestors(node);
        const lazy = ancestors.some(
          (ancestor) => ancestor.type === "CallExpression" && LAZY_HOOKS.has(calleeName(ancestor.callee)),
        );
        if (!lazy) context.report({ node, messageId: "renderRandom" });
      },
    };
  },
};
