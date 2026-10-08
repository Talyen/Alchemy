// Fail early if the configured native parser is unavailable; it is a runtime-loaded dependency.
import "@swc/core";
import { APPLICATION_SESSION_ADAPTERS } from "./lint/session-ownership.js";
// Cruiser mirrors the layer-isolation subset of lint/boundaries.js.
// Full boundary table (GAME_DATA_NO_BATTLE, LIB_NO_FRAMEWORK, WRITE_PORT, etc.) is enforced via Oxlint;
// see lint/boundaries.js + oxlint.config.ts for the complete source of truth.
// Cruiser covers: lib-no-features, meta/run-loop/run-setup isolation,
// game-data-no-battle, circular, gameplay-aggregate-internal.
// Not covered here (Oxlint-only): barrel deep-import bans, write-port
// internals, NO_DIRECT_ASSET_IMPORT, UI_NO_SESSION_STORES, orchestration/screens
// rules. `npm run lint` is the complete gate; `lint:boundaries` is the fast subset.
import {
  GAME_DATA_NO_BATTLE,
  LIB_NO_FEATURES,
  META_NO_RUN_LOOP,
  RUN_LOOP_NO_RUN_SETUP,
  RUN_SETUP_NO_RUN_LOOP,
  cruiserPathFromGroups,
} from "./lint/boundaries.js";

function edge(name, fromPath, patterns) {
  return {
    name,
    severity: "error",
    comment: `Derived from lint/boundaries.js: ${patterns.map((pattern) => pattern.message).join(" ")}`,
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
      name: "application-singletons-belong-to-adapters",
      severity: "error",
      from: {
        pathNot: [...APPLICATION_SESSION_ADAPTERS.map((file) => `^${file.replaceAll(".", "\\.")}$`)],
      },
      to: { path: "^src/app/(application-session|battle-presentation)\\.ts$" },
    },
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
    edge("game-data-no-battle", "^src/lib/game-data/", GAME_DATA_NO_BATTLE),
    {
      name: "gameplay-aggregate-is-internal",
      severity: "error",
      comment: "Only shared/stores may import the authoritative gameplay aggregate directly.",
      from: { pathNot: "^src/features/alchemy/shared/stores/" },
      to: { path: "^src/features/alchemy/shared/stores/(gameplay-state-store|gameplay-state)\\.ts$" },
    },
    {
      name: "game-session-runtime-is-internal",
      severity: "error",
      comment: "Session consumers bind capability ports; only stores and persistence adapters reach runtime state.",
      from: {
        pathNot: [
          "^src/features/alchemy/shared/(stores/|storage/(io|persistence)\\.ts$)",
          "^src/app/application-session\\.ts$",
        ],
      },
      to: { path: "^src/features/alchemy/shared/stores/session-runtime\\.ts$" },
    },
    {
      name: "gameplay-mutation-is-internal",
      severity: "error",
      comment: "Feature commands use readonly transactions and domain operations; hydration is trusted infrastructure.",
      from: { pathNot: "^src/features/alchemy/shared/(stores/|storage/persistence\\.ts$)" },
      to: { path: "^src/features/alchemy/shared/stores/(gameplay-command|transaction-internal|readonly-view)\\.ts$" },
    },
  ].map((rule) => ({
    ...rule,
    // SWC retains erased type edges. Keep this graph gate on runtime dependencies;
    // Oxlint independently applies the full import policies, including type imports.
    to: {
      ...rule.to,
      dependencyTypesNot: ["type-only"],
      ...(rule.to.circular ? { viaOnly: { dependencyTypesNot: ["type-only"] } } : {}),
    },
  })),
  options: {
    doNotFollow: {
      path: ["node_modules", "dist", "coverage", "playwright-report", "test-results"],
    },
    parser: "swc",
    webpackConfig: { fileName: "dependency-cruiser-resolve.config.mjs" },
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
