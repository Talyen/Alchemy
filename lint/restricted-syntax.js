/** Preserve the existing selector policies using Oxlint's JS visitor API. */
export const restrictedSyntax = {
  meta: {
    type: "problem",
    schema: {
      type: "array",
      items: {
        type: "object",
        required: ["selector", "message"],
        properties: { selector: { type: "string" }, message: { type: "string" } },
        additionalProperties: false,
      },
    },
  },
  create(context) {
    const visitors = {};
    for (const { selector, message } of context.options) {
      const previous = visitors[selector];
      visitors[selector] = (node) => {
        previous?.(node);
        context.report({ node, message });
      };
    }
    return visitors;
  },
};
