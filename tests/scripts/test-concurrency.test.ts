import { expect, it } from "vitest";
import { resolveVitestMaxWorkers } from "../../scripts/lib/verification/test-concurrency.mjs";

it("keeps the default ceiling and permits lower worker counts for a busy host", () => {
  expect(resolveVitestMaxWorkers(undefined)).toBe(4);
  for (const workers of ["1", "2", "3", "4"]) expect(resolveVitestMaxWorkers(workers)).toBe(Number(workers));
});

it.each(["", "0", "5", "-1", "1.5", "NaN", "Infinity", "1e0"])(
  "rejects an invalid worker override %j instead of raising the shared resource ceiling",
  (value) => {
    expect(() => resolveVitestMaxWorkers(value)).toThrow("ALCHEMY_TEST_MAX_WORKERS");
  },
);
