import { describe, expect, it, vi } from "vitest";
// @ts-expect-error — check-handoff.mjs is JS without declarations; verify via runtime
import { captureSourceDigest, runHandoff } from "../../scripts/check-handoff.mjs";

describe("handoff orchestrator", () => {
  it("runs steps in order with shared run ID and strict verification", async () => {
    const calls: string[] = [];
    const runner = vi.fn((label: string) => {
      calls.push(label);
      return 0;
    });
    const digest = { head: "abc", hash: "hash1", raw: "raw" };
    const code = await runHandoff(["--diff"], {
      runner,
      captureDigest: () => digest,
    });
    expect(code).toBe(0);
    expect(calls).toEqual([
      "changed-path verification",
      "static checks (lint:ci)",
      "unit tests (vitest)",
      "verified build",
      "preview smoke",
      "prepush canary",
      "docs final",
      "exposure check",
    ]);
    const exposureCall = (
      runner.mock.calls.find((c) => (c as unknown as string[])[0] === "exposure check") as unknown as string[][]
    )?.[2] as string[] | undefined;
    expect(exposureCall?.join(" ")).toContain("--run-id");
    const firstCall = runner.mock.calls[0] as unknown as [string, string, string[], Record<string, string>];
    expect(firstCall[3].ALCHEMY_RUN_ID).toBeDefined();
    const firstId = firstCall[3].ALCHEMY_RUN_ID;
    for (const call of runner.mock.calls) {
      expect((call as unknown as [string, string, string[], Record<string, string>])[3].ALCHEMY_RUN_ID).toBe(firstId);
    }
  });

  it("fail-fast stops after first failure", async () => {
    const runner = vi.fn((label: string) => (label === "static checks (lint:ci)" ? 1 : 0));
    const code = await runHandoff(["--diff"], {
      runner,
      captureDigest: () => ({ head: "a", hash: "h", raw: "" }),
    });
    expect(code).toBe(1);
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it("fails when source digest drifts", async () => {
    let count = 0;
    const captureDigest = () => {
      count += 1;
      return count === 1 ? { head: "a", hash: "before", raw: "" } : { head: "a", hash: "after", raw: "" };
    };
    const runner = vi.fn(() => 0);
    const code = await runHandoff(["--diff"], { runner, captureDigest });
    expect(code).toBe(1);
  });

  it("captures source digest", () => {
    const digest = captureSourceDigest();
    expect(digest.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(digest.head).toBeDefined();
  });
});
