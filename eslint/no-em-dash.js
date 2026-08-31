const EM_DASH = "\u2014";

/** @type {import("eslint").Rule.RuleModule} */
export const noEmDash = {
  meta: {
    type: "problem",
    docs: {
      description: "Ban em dashes (—) in player-facing strings. Rewrite without —.",
    },
    schema: [],
    messages: {
      unexpected: "Unexpected em dash (—). Rewrite without —.",
    },
  },
  create(context) {
    function check(value, node) {
      if (typeof value === "string" && value.includes(EM_DASH)) {
        context.report({ node, messageId: "unexpected" });
      }
    }
    return {
      Literal(node) {
        if (typeof node.value === "string") check(node.value, node);
      },
      TemplateElement(node) {
        check(node.value.cooked ?? node.value.raw, node);
      },
    };
  },
};
