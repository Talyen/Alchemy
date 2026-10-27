import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  beginBuildAttempt,
  finishBuildAttempt,
  promotePackageAttempt,
  protectPackageAttempts,
} from "../../scripts/lib/build-retention.mjs";
import { pruneTransientArtifacts } from "../../scripts/prune-transient-artifacts.mjs";
import { registerArtifactSession, withArtifactGuard } from "../../scripts/lib/artifact-guard.mjs";

const roots: string[] = [];
const DAY = 86_400_000;
const now = Date.now();
function fixture(preexisting = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-build-retention-"));
  roots.push(root);
  const output = path.join(root, "release-desktop");
  if (preexisting) fs.mkdirSync(output);
  const attempt = beginBuildAttempt(root, {
    kind: "package",
    target: "release-desktop",
    eligible: true,
    now: now - 2 * DAY,
  });
  const target = attempt.staging ? path.join(root, attempt.staging) : output;
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, "partial"), "failed build");
  finishBuildAttempt(root, attempt, false, now - 2 * DAY);
  return { root, target, attempt };
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await withArtifactGuard(root, ({ directory }) => fs.rmSync(directory, { recursive: true, force: true }));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it("reports then removes only a managed failed packaging output after its owner releases", async () => {
  const { root, target, attempt } = fixture();
  const release = await registerArtifactSession(root);
  try {
    expect((await pruneTransientArtifacts({ rootDir: root, now, dryRun: true })).skippedActive).toBe(true);
  } finally {
    release();
  }
  const preview = await pruneTransientArtifacts({ rootDir: root, now, dryRun: true });
  expect(preview.removed).toEqual([{ path: attempt.staging, bytes: 12 }]);
  expect(fs.existsSync(target)).toBe(true);
  expect((await pruneTransientArtifacts({ rootDir: root, now })).removed).toEqual(preview.removed);
  expect(fs.existsSync(target)).toBe(false);
});

it("preserves unknown pre-existing, changed, kept, linked and later successful output", async () => {
  const unknown = fixture(true);
  const changed = fixture();
  fs.writeFileSync(path.join(changed.target, "new-file"), "unknown");
  const kept = fixture();
  fs.writeFileSync(path.join(kept.target, ".keep"), "");
  const linked = fixture();
  fs.symlinkSync(unknown.target, path.join(linked.target, "external"));
  const succeeded = fixture();
  const next = beginBuildAttempt(succeeded.root, { kind: "package", target: "release-desktop", now: now - DAY });
  finishBuildAttempt(succeeded.root, next, true, now - DAY);
  for (const { root, target } of [unknown, changed, kept, linked, succeeded]) {
    expect((await pruneTransientArtifacts({ rootDir: root, now })).removed).toEqual([]);
    expect(fs.existsSync(target)).toBe(true);
  }
});

it("preserves a failed output if upload was attempted, a receipt is unreadable, or a producer is unresolved", async () => {
  const distributed = fixture();
  protectPackageAttempts(distributed.root, "release-desktop");
  const invalid = fixture();
  fs.writeFileSync(path.join(invalid.root, ".cache/build-retention/00000000-0000-0000-0000-000000000000.json"), "bad");
  const running = fixture();
  beginBuildAttempt(running.root, { kind: "package", target: "release-desktop", now: now - DAY });
  for (const { root, target } of [distributed, invalid, running]) {
    expect((await pruneTransientArtifacts({ rootDir: root, now })).removed).toEqual([]);
    expect(fs.existsSync(target)).toBe(true);
  }
});

it("promotes an isolated package without replacing a concurrent canonical output", () => {
  const { root, target, attempt } = fixture();
  promotePackageAttempt(root, attempt);
  expect(fs.readFileSync(path.join(root, "release-desktop/partial"), "utf8")).toBe("failed build");
  expect(fs.existsSync(target)).toBe(false);
  const collision = fixture();
  fs.mkdirSync(path.join(collision.root, "release-desktop"));
  fs.writeFileSync(path.join(collision.root, "release-desktop/existing"), "preserve");
  expect(() => promotePackageAttempt(collision.root, collision.attempt)).toThrow();
  expect(fs.readFileSync(path.join(collision.root, "release-desktop/existing"), "utf8")).toBe("preserve");
  expect(fs.existsSync(collision.target)).toBe(true);
});
