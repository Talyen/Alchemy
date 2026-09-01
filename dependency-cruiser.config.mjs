// Cruiser mirrors the layer-isolation subset of eslint/boundaries.js.
// Full boundary table (GAME_DATA_NO_BATTLE, LIB_NO_FRAMEWORK, WRITE_PORT, etc.) is enforced via eslint;
// see eslint/boundaries.js + eslint.config.js for the complete source of truth.
import {
  LIB_NO_FEATURES,
  META_NO_RUN_LOOP,
  RUN_LOOP_NO_RUN_SETUP,
  RUN_SETUP_NO_RUN_LOOP,
  cruiserPathFromGroups,
} from "./eslint/boundaries.js";

function edge(name, fromPath, patterns) {
  return {
    name,
    severity: "error",
    comment: `Derived from eslint/boundaries.js: ${patterns.map((pattern) => pattern.message).join(" ")}`,
    from: { path: fromPath },
    to: { path: cruiserPathFromGroups(patterns.flatMap((pattern) => pattern.group)) },
  };
}

const META_LAYER = "^src/features/alchemy/meta/";

/** @type {import('dependency-cruiser').IConfiguration} */
const [META_RUN_LOOP, META_RUN_SETUP] = META_NO_RUN_LOOP;

export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Keep leaf battle and data modules independent from the orchestrators that consume them.",
      from: {},
      to: { circular: true },
    },
    edge("lib-no-features", "^src/lib/", LIB_NO_FEATURES),
    edge("meta-no-run-loop", META_LAYER, [META_RUN_LOOP]),
    edge("meta-no-run-setup", META_LAYER, [META_RUN_SETUP]),
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
