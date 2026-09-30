// Single concurrency budget for test runners. Ship-gate unit suites pin
// --maxWorkers=4: two concurrent tsc invocations plus type-aware ESLint is the
// OOM risk on small machines, and ship suites run for minutes. Local
// Dependency-related local checks share this budget so concurrent repository
// sessions cannot fan out across every core. CI full `vitest run` keeps defaults; `check:static`/`lint:ci` cap fan-out via
// concurrently --max-process 4/3 for the same reason.
export const VITEST_MAX_WORKERS = 4;
