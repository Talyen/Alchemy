import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { captureVerificationInputs, createVerificationCache } from "../../scripts/lib/verification-cache.mjs";

const roots: string[] = [];
const command = { key: "unit-changed", command: "npx", args: ["vitest", "run", "tests/example.test.ts"] };
function temporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "verification-cache-"));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("local unit verification reuse", () => {
  it("reuses only exact coverage and expires without renewing a reused result", () => {
    const root = temporaryRoot();
    let now = 1;
    const options = { env: {}, minimumDurationMs: 0, capture: () => "inputs", now: () => now };
    const cache = createVerificationCache(root, [command], options);
    expect(cache.read(command)).toBeNull();
    expect(cache.finish([{ command, passed: true, result: { elapsedMs: 1_000 } }], "first")).toBe(true);
    expect(cache.read(command)?.runId).toBe("first");
    expect(cache.read({ ...command, args: [...command.args, "tests/other.test.ts"] })).toBeNull();
    expect(cache.read({ ...command, args: [...command.args].reverse() })).toBeNull();
    now = 3_500_000;
    cache.finish([{ command, passed: true, reused: "first" }], "second");
    now = 3_600_001;
    expect(cache.read(command)).toBeNull();
  });

  it("invalidates failures and input drift and ignores corrupt receipts", () => {
    const root = temporaryRoot();
    let inputs = "first";
    const options = { env: {}, minimumDurationMs: 0, capture: () => inputs };
    const cache = createVerificationCache(root, [command], options);
    cache.finish([{ command, passed: true, result: { elapsedMs: 1_000 } }], "one");
    cache.finish([{ command, passed: false }], "two");
    expect(cache.read(command)).toBeNull();
    cache.finish([{ command, passed: true, result: { elapsedMs: 1_000 } }], "three");
    inputs = "changed";
    expect(cache.finish([{ command, passed: true, result: { elapsedMs: 1_000 } }], "four")).toBe(false);
    expect(cache.read(command)).toBeNull();
    const fresh = createVerificationCache(root, [command], options);
    fresh.finish([{ command, passed: true, result: { elapsedMs: 1_000 } }], "five");
    const directory = path.join(root, "reports/verification-cache");
    for (const file of fs.readdirSync(directory)) fs.writeFileSync(path.join(directory, file), "broken JSON");
    expect(fresh.read(command)).toBeNull();
  });

  it("keeps CI, fresh runs and artifact-producing commands outside reuse", () => {
    const root = temporaryRoot();
    const options = { env: {}, minimumDurationMs: 0, capture: () => "inputs" };
    createVerificationCache(root, [command], options).finish(
      [{ command, passed: true, result: { elapsedMs: 1_000 } }],
      "original",
    );
    expect(createVerificationCache(root, [command], { ...options, env: { CI: "true" } }).read(command)).toBeNull();
    const fresh = createVerificationCache(root, [command], { ...options, env: { ALCHEMY_VERIFY_FRESH: "1" } });
    expect(fresh.read(command)).toBeNull();
    fresh.finish([{ command, passed: false }], "failed-fresh");
    expect(createVerificationCache(root, [command], options).read(command)).toBeNull();
    const artifact = { ...command, key: "assets-check" };
    const artifacts = createVerificationCache(root, [artifact], options);
    artifacts.finish([{ command: artifact, passed: true }], "asset");
    expect(artifacts.read(artifact)).toBeNull();
    expect(createVerificationCache(root, [command], { ...options, capture: () => null }).read(command)).toBeNull();
  });

  it("avoids input scans for new and cheap commands, then establishes proof for expensive repetitions", () => {
    const root = temporaryRoot();
    let scans = 0;
    const options = {
      env: {},
      capture: () => {
        scans++;
        return "inputs";
      },
      now: () => 1,
    };
    const first = createVerificationCache(root, [command], options);
    first.finish([{ command, passed: true, result: { elapsedMs: 100 } }], "cheap");
    expect(scans).toBe(0);
    const second = createVerificationCache(root, [command], options);
    second.finish([{ command, passed: true, result: { elapsedMs: 6_000 } }], "slow");
    expect(scans).toBe(0);
    const third = createVerificationCache(root, [command], options);
    expect(third.read(command)).toBeNull();
    third.finish([{ command, passed: true, result: { elapsedMs: 6_000 } }], "proven");
    expect(scans).toBe(2);
    expect(createVerificationCache(root, [command], options).read(command)?.runId).toBe("proven");
  });

  it("detects source, environment and dependency mutations including ignored environment files", () => {
    const root = temporaryRoot();
    execFileSync("git", ["init", "-q", root]);
    fs.writeFileSync(path.join(root, ".gitignore"), "node_modules/\nreports/\n.env\n");
    fs.mkdirSync(path.join(root, "node_modules/example"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules/.package-lock.json"), "{}");
    fs.writeFileSync(path.join(root, "node_modules/example/index.js"), "first");
    fs.writeFileSync(path.join(root, "source.ts"), "first");
    const initial = captureVerificationInputs(root, {});
    expect(initial).toMatch(/^[0-9a-f]{64}$/u);
    expect(captureVerificationInputs(root, { ALCHEMY_RUN_ID: "other" })).toBe(initial);
    expect(captureVerificationInputs(root, { NODE_OPTIONS: "--conditions=test" })).not.toBe(initial);
    for (const filename of ["source.ts", "node_modules/example/index.js", ".env"]) {
      const before = captureVerificationInputs(root, {});
      fs.writeFileSync(path.join(root, filename), "replacement");
      expect(captureVerificationInputs(root, {})).not.toBe(before);
    }
    const before = captureVerificationInputs(root, {});
    fs.rmSync(path.join(root, "source.ts"));
    expect(captureVerificationInputs(root, {})).not.toBe(before);
    fs.rmSync(path.join(root, "node_modules/.package-lock.json"));
    expect(captureVerificationInputs(root, {})).toBeNull();
  });
});
