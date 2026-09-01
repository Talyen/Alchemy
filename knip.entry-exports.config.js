import config from "./knip.config.js";

export default {
  ...config,
  ignoreIssues: {
    ...config.ignoreIssues,
    // Executable modules remain covered by the normal dead-code audit; this pass scrutinizes source API barrels.
    "scripts/**": ["exports", "types"],
    "desktop/**": ["exports", "types"],
  },
};
