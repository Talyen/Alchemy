const DIRECTIVE_RE = /^(eslint|@ts-|prettier-ignore|c8|v8|@vite-|istanbul|#?__PURE__|@__NO_SIDE_EFFECTS__)/;

/** @type {import("eslint").Rule.RuleModule} */
export const noComments = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description: "Ban comments — use code, types, and tests instead. Only tool directives are allowed.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowDirectives: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unexpected: "Comments are not allowed. Express intent via code, types, or tests.",
    },
  },
  create(context) {
    const allowDirectives = context.options[0]?.allowDirectives !== false;
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (allowDirectives && DIRECTIVE_RE.test(comment.value.trim())) continue;
          context.report({
            loc: comment.loc,
            messageId: "unexpected",
            fix(fixer) {
              if (comment.range) return fixer.removeRange(comment.range);
              return null;
            },
          });
        }
      },
    };
  },
};
