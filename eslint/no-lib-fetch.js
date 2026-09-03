/** @type {import("eslint").Rule.RuleModule} */
export const noLibFetch = {
  meta: {
    type: "problem",
    docs: {
      description: "src/lib must not perform network I/O; push it to an owned seam.",
    },
    schema: [],
    messages: {
      fetch: "src/lib must not call {{name}}(). Move network I/O to an owned seam.",
    },
  },
  create(context) {
    const BANNED_GLOBALS = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon"]);
    function calleeName(node) {
      if (node.type === "Identifier") return node.name;
      if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
        return node.property.name;
      }
      return "";
    }
    function isBannedNew(node) {
      return node.type === "NewExpression" && node.callee.type === "Identifier" && BANNED_GLOBALS.has(node.callee.name);
    }
    return {
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (BANNED_GLOBALS.has(name)) context.report({ node: node.callee, messageId: "fetch", data: { name } });
      },
      NewExpression(node) {
        if (isBannedNew(node)) {
          const name = node.callee.name;
          context.report({ node: node.callee, messageId: "fetch", data: { name: `new ${name}` } });
        }
      },
    };
  },
};
