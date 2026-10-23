// Shared ceiling for Vitest defaults and ship suites. Completion gates explicitly
// use one worker for full-repository and dependency-related selections.
// Above four workers, subprocess-heavy tooling and JSDOM setup can contend
// enough to make the full suite slower and trigger five-second timeouts.
// vitest.config.ts also leaves one CPU free on smaller machines.
export const VITEST_MAX_WORKERS = 4;
