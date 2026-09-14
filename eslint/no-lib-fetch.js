import { restrictedGlobalReferences } from "./restricted-global-references.js";

const NETWORK_GLOBALS = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "sendBeacon", "navigator.sendBeacon"];

/** @type {import("eslint").Rule.RuleModule} */
export const noLibFetch = {
  meta: {
    type: "problem",
    docs: {
      description: "src/lib must not perform network I/O; push it to an owned seam.",
    },
    schema: [],
    messages: {
      fetch: "src/lib must not use {{name}}. Move network I/O to an owned seam.",
    },
  },
  create(context) {
    return restrictedGlobalReferences(context, NETWORK_GLOBALS, (node, name) =>
      context.report({ node, messageId: "fetch", data: { name } }),
    );
  },
};
