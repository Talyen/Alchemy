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
  },
};
