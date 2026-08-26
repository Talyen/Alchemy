/** @type {import("eslint").Rule.RuleModule} */
export const noLibFetch = {
  meta: {
    type: "problem",
    docs: {
      description: "src/lib must not call fetch; push network I/O to an owned seam.",
    },
    schema: [],
    messages: {
      fetch: "src/lib must not call fetch(). Move network I/O to an owned seam.",
    },
  },
  create(context) {
    function isFetchCallee(node) {
      if (node.type === "Identifier") return node.name === "fetch";
      if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
        return node.property.name === "fetch";
      }
      return false;
    }
    return {
      CallExpression(node) {
        if (isFetchCallee(node.callee)) context.report({ node: node.callee, messageId: "fetch" });
      },
    };
  },
};
