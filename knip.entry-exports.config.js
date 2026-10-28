import config from "./knip.config.js";

export default {
  ...config,
  ignoreIssues: {
    ...config.ignoreIssues,
    // Executable modules remain covered by the normal dead-code audit; this pass scrutinizes source API barrels.
    "scripts/**": ["exports", "types"],
    "desktop/**": ["exports", "types"],
    // Vite SSR workers load these modules by string path, so Knip cannot trace their runtime consumers.
    "src/app/playthrough/career.ts": ["exports"],
    "src/app/playthrough/report.ts": ["exports"],
    "src/lib/balance/materials-report.ts": ["exports"],
    // The batch CLI loads the balance barrel through Vite SSR and consumes these by name.
    "src/lib/balance/report-run.ts": ["exports"],
    "src/lib/balance/report-sweeps.ts": ["exports"],
    // Public barrel exports retained for test and external consumers.
    "src/lib/battle/index.ts": ["exports"],
    "src/lib/game-data/cards.ts": ["exports"],
    "src/lib/localization/catalog-format.d.mts": ["exports", "types"],
  },
};
