const ESLINT_DISABLE_RE = /^eslint-disable(?:-next-line|-line)?(?:\s|$)/;

/** @type {import("eslint").Rule.RuleModule} */
export const requireDisableReason = {
  meta: {
    type: "problem",
    docs: { description: "Require an explanation when disabling an ESLint rule." },
    schema: [],
    messages: { missingReason: "ESLint disable directives must include a reason after -- ." },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const text = comment.value.trim();
          if (ESLINT_DISABLE_RE.test(text) && !/--\s*\S/.test(text)) {
            context.report({ loc: comment.loc, messageId: "missingReason" });
          }
        }
      },
    };
  },
};
