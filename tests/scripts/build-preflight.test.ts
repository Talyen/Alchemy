import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../../scripts/sync-generated.mjs", () => ({ syncGenerated: vi.fn() }));
vi.mock("../../scripts/lib/run-command.mjs", () => ({ runTaskCommand: vi.fn() }));
vi.mock("../../scripts/lib/script-run.mjs", () => ({ defineScript: vi.fn(), UsageError: Error }));
vi.mock("../../scripts/lib/build-retention.mjs", () => ({ beginBuildAttempt: vi.fn(), finishBuildAttempt: vi.fn() }));

const { syncGenerated } = await import("../../scripts/sync-generated.mjs");
const { runTaskCommand } = await import("../../scripts/lib/run-command.mjs");
const { runBuildVerified } = await import("../../scripts/build-verified.mjs");

beforeEach(() => {
  vi.mocked(syncGenerated).mockReset().mockResolvedValue(undefined);
  vi.mocked(runTaskCommand).mockReset();
});

it("starts both checks together and waits for generated outputs before compiling", async () => {
  let finish!: () => void;
  vi.mocked(syncGenerated).mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  vi.mocked(runTaskCommand).mockResolvedValue({ status: 0 } as never);
  const build = runBuildVerified([]);
  await Promise.resolve();
  expect(syncGenerated).toHaveBeenCalledWith({ check: true });
  expect(runTaskCommand).toHaveBeenCalledTimes(1);
  finish();
  await expect(build).resolves.toBe(0);
  expect(runTaskCommand).toHaveBeenLastCalledWith("npx", ["vite", "build"], expect.any(Object));
});

it("waits for localization even when generated outputs fail and reports both failures", async () => {
  let finish!: (value: never) => void;
  vi.mocked(runTaskCommand).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  vi.mocked(syncGenerated).mockRejectedValue(new Error("stale generated outputs"));
  let settled = false;
  const build = runBuildVerified([]).catch((error: unknown) => {
    settled = true;
    return error;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  finish({ status: 1 } as never);
  const failure = await build;
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as Error).message).toContain("stale generated outputs");
  expect((failure as Error).message).toContain("Localization is not current");
  expect(runTaskCommand).toHaveBeenCalledTimes(1);
});

it("does not compile when localization alone fails", async () => {
  vi.mocked(runTaskCommand).mockResolvedValue({ status: 1 } as never);
  await expect(runBuildVerified([])).rejects.toThrow("Localization is not current");
  expect(runTaskCommand).toHaveBeenCalledTimes(1);
});

it("keeps help free of preflight work", async () => {
  vi.mocked(runTaskCommand).mockResolvedValue({ status: 0 } as never);
  await expect(runBuildVerified(["--help"])).resolves.toBe(0);
  expect(syncGenerated).not.toHaveBeenCalled();
  expect(runTaskCommand).toHaveBeenCalledExactlyOnceWith("npx", ["vite", "build", "--help"], expect.any(Object));
});
