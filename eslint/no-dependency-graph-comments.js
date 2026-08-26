/** @type {RegExp} */
const GRAPH_COMMENT_RE = /\bDepends on\b|\bDepends only on\b|\bDepended on by\b|\bUsed by:/;

/** @type {import("eslint").Rule.RuleModule} */
export const noDependencyGraphComments = {
  meta: {
    type: "problem",
    docs: {
      description: "Ban import/consumer graphs in comments; they go stale.",
    },
    schema: [],
    messages: {
      graph: "Do not record import/consumer graphs in comments. Imports and search already answer that.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (GRAPH_COMMENT_RE.test(comment.value)) {
            context.report({ loc: comment.loc, messageId: "graph" });
          }
        }
      },
    };
  },
};
