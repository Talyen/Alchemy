const LINT_DISABLE_RE = /^(?:oxlint|eslint)-disable(?:-next-line|-line)?(?:\s|$)/;

/** @type {Parameters<import("oxlint/plugins-dev").RuleTester["run"]>[1]} */
export const requireDisableReason = {
  meta: {
    type: "problem",
    docs: { description: "Require an explanation when disabling a lint rule." },
    schema: [],
    messages: { missingReason: "Lint disable directives must include a reason after -- ." },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const text = comment.value.trim();
          if (LINT_DISABLE_RE.test(text) && !/--\s*\S/.test(text)) {
            context.report({ loc: comment.loc, messageId: "missingReason" });
          }
        }
      },
    };
  },
};
