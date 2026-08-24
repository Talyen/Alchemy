// Projection of the import-boundary policy onto the module graph.
// The policy and its import-pattern groups are owned by eslint/fragments.js
// (applied to source by eslint/boundaries.js); every phase edge below derives
// its target path from those groups, so the lint gate and this gate cannot
// drift. gameplay-aggregate-is-internal has no fragments equivalent — it
// guards a single store file rather than an import-specifier group — and
// therefore stays declared locally.
import { LIB_NO_FEATURES, META_NO_RUN_LOOP, RUN_LOOP_NO_RUN_SETUP, RUN_SETUP_NO_RUN_LOOP } from "./eslint/fragments.js";

/**
 * Convert an ESLint import-group list to a depcruise path regex.
 * Groups use either the alias form (starts with the @ alias) or, for
 * feature-local targets, a deep-glob form relative to src/features/alchemy.
 */
function toTargetPath(groups) {
  const alias = groups.find((group) => group.startsWith("@/"));
  if (alias) return `^src/${alias.replace(/^@\//, "").replace(/\/\*\*$/, "")}/`;
  const deep = groups
    .at(-1)
    .replace(/^\*\*\//, "")
    .replace(/\/\*\*$/, "");
  return `^src/features/alchemy/${deep}/`;
}

function edge(name, fromPath, patterns) {
  return {
    name,
    severity: "error",
    comment: `Derived from eslint/fragments.js: ${patterns.map((pattern) => pattern.message).join(" ")}`,
    from: { path: fromPath },
    to: { path: toTargetPath(patterns.flatMap((pattern) => pattern.group)) },
  };
}

const META_LAYER = "^src/features/alchemy/meta/";

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    edge("lib-no-features", "^src/lib/", LIB_NO_FEATURES),
    edge("meta-no-run-loop", META_LAYER, [META_NO_RUN_LOOP[0]]),
    edge("meta-no-run-setup", META_LAYER, [META_NO_RUN_LOOP[1]]),
    edge("run-setup-no-run-loop", "^src/features/alchemy/run-setup/", RUN_SETUP_NO_RUN_LOOP),
    edge("run-loop-no-run-setup", "^src/features/alchemy/run-loop/", RUN_LOOP_NO_RUN_SETUP),
    {
      name: "gameplay-aggregate-is-internal",
      severity: "error",
      comment: "Only shared/stores may import the authoritative gameplay aggregate directly.",
      from: { pathNot: "^src/features/alchemy/shared/stores/" },
      to: { path: "^src/features/alchemy/shared/stores/gameplay-state-store\\.ts$" },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "dist", "coverage", "playwright-report", "test-results"],
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    // Keep the report focused on phase / lib edges; ESLint still owns barrel + facade rules.
    includeOnly: {
      path: "^src/",
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
