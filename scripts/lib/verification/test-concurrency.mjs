// Shared ceiling for full Vitest runs, ship suites, and related-test selection.
// Above four workers, subprocess-heavy tooling and JSDOM setup can contend
// enough to make the full suite slower and trigger five-second timeouts.
// vitest.config.ts also leaves one CPU free on smaller machines.
export const VITEST_MAX_WORKERS = 4;
