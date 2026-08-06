import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

describe("active run bootstrap", () => {
  it("applies persisted currentScreen during domain restore", () => {
    const source = read("src/features/alchemy/shared/stores/run-transitions.ts");
    const codec = read("src/features/alchemy/shared/stores/run-resume-codec.ts");
    expect(source).toContain("decodeRunResumeSnapshot");
    expect(source).toContain("session.runActions.setScreen(decoded.screen");
    expect(codec).toContain("let screen = activeRun.currentScreen");
  });

  it("restores active run before first AppInner paint", () => {
    const app = read("src/App.tsx");
    const controller = read("src/features/alchemy/shell/use-alchemy-run-controller.ts");
    expect(app).toContain("restoreRun(result.data.activeRun");
    expect(app).toContain("readRunInitialized");
    expect(controller).toContain("useLayoutEffect");
    expect(controller).not.toContain("restoreRun(");
    expect(controller).toContain("Bootstrap restore lives in App");
  });
});
