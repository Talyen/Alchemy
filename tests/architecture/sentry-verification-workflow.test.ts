import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");
const workflow = readFileSync(join(ROOT, ".github/workflows/sentry-verify.yml"), "utf8");

describe("private Sentry verification workflow", () => {
  it("is manual-only and cannot publish a Steam or GitHub release", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+push:/m);
    expect(workflow).not.toContain("steam-upload");
    expect(workflow).not.toContain("action-gh-release");
    expect(workflow).not.toContain("STEAM_USERNAME");
  });

  it("requires all crash reporting secrets and marks only its package as a crash-test build", () => {
    for (const secret of ["SENTRY_DSN", "SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"]) {
      expect(workflow).toContain(`secrets.${secret}`);
    }
    expect(workflow).toContain('SENTRY_CRASH_TEST_BUILD: "true"');
    expect(workflow).toContain("SENTRY_RELEASE=alchemy@$version-sentry-test.");
    for (const mode of ["renderer", "main", "native-renderer"]) {
      expect(workflow).toContain(`"${mode}"`);
    }
    expect(workflow).toContain("--alchemy-sentry-test=$mode");
    expect(workflow).toContain("Sentry transport confirmed for ${mode}");
    expect(workflow).toContain("ALCHEMY_SENTRY_TEST_STATUS_DIR");
  });
});
