const DIRECTIVE_RE =
  /^(eslint-disable(?:-next-line|-line)?|eslint-enable|@ts-expect-error|@ts-ignore|@ts-nocheck|prettier-ignore|c8 ignore|v8 ignore|@vite-ignore|istanbul ignore|#__PURE__|@__NO_SIDE_EFFECTS__)(?:\s|$)/;

const ESLINT_DISABLE_RE = /^eslint-disable(?:-next-line|-line)?(?:\s|$)/;

/** @type {import("eslint").Rule.RuleModule} */
export const noComments = {
  meta: {
    type: "problem",
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
      missingReason: "ESLint disable directives must include a reason after -- .",
    },
  },
  create(context) {
    const allowDirectives = context.options[0]?.allowDirectives !== false;
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const trimmed = comment.value.trim();
          if (allowDirectives && DIRECTIVE_RE.test(trimmed)) {
            if (ESLINT_DISABLE_RE.test(trimmed) && !trimmed.includes(" -- ")) {
              context.report({
                loc: comment.loc,
                messageId: "missingReason",
              });
            }
            continue;
          }
          context.report({
            loc: comment.loc,
            messageId: "unexpected",
          });
        }
      },
    };
  },
};
