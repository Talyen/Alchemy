const DEFAULT_MAX_WORKERS = 4;

export function resolveVitestMaxWorkers(value) {
  if (value === undefined) return DEFAULT_MAX_WORKERS;
  const workers = Number(value);
  if (!/^[1-9]\d*$/u.test(value) || workers > DEFAULT_MAX_WORKERS)
    throw new Error(`ALCHEMY_TEST_MAX_WORKERS must be an integer from 1 to ${DEFAULT_MAX_WORKERS}.`);
  return workers;
}

// Lower concurrency on a busy host without changing coverage or timeout limits.
// The shared ceiling still bounds full Vitest runs, ship suites and related selection.
export const VITEST_MAX_WORKERS = resolveVitestMaxWorkers(process.env.ALCHEMY_TEST_MAX_WORKERS);
