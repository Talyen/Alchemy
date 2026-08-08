/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "lib-no-features",
      severity: "error",
      comment: "src/lib must stay free of @/features imports.",
      from: { path: "^src/lib/" },
      to: { path: "^src/features/" },
    },
    {
      name: "meta-no-run-loop",
      severity: "error",
      comment: "meta must not import run-loop.",
      from: { path: "^src/features/alchemy/meta/" },
      to: { path: "^src/features/alchemy/run-loop/" },
    },
    {
      name: "meta-no-run-setup",
      severity: "error",
      comment: "meta must not import run-setup.",
      from: { path: "^src/features/alchemy/meta/" },
      to: { path: "^src/features/alchemy/run-setup/" },
    },
    {
      name: "run-setup-no-run-loop",
      severity: "error",
      comment: "run-setup must use shared/run-flow instead of importing run-loop.",
      from: { path: "^src/features/alchemy/run-setup/" },
      to: { path: "^src/features/alchemy/run-loop/" },
    },
    {
      name: "run-loop-no-run-setup",
      severity: "error",
      comment: "run-loop must use shared/run-flow / shell deps instead of importing run-setup.",
      from: { path: "^src/features/alchemy/run-loop/" },
      to: { path: "^src/features/alchemy/run-setup/" },
    },
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
