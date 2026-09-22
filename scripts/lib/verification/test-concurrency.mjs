// Single concurrency budget for test runners. Ship-gate unit suites pin
// --maxWorkers=4: two concurrent tsc invocations plus type-aware ESLint is the
// OOM risk on small machines, and ship suites run for minutes. Local
// `vitest related` and CI full `vitest run` keep Vitest defaults (auto) so
// large machines stay fast; `check:static`/`lint:ci` cap fan-out via
// concurrently --max-process 4/3 for the same reason.
export const VITEST_MAX_WORKERS = 4;
